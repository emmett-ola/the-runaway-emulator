// @vitest-environment node
import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Zip, ZipDeflate, ZipPassThrough, zipSync } from 'fflate';
import { encodeCanonical, sha256 } from '../../../shared/codec';
import type { Manifest } from '../storage';
import { readArchive } from './archive-import';
import { EXPORT_LIMITS, moduleFor } from './validation';
import { preflightZip } from './zip-preflight';

if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const PEER = '22222222-2222-4222-8222-222222222222';
const PROFILE = `accounts/${ACCOUNT}/profile.json`;
const PEER_PROFILE = `accounts/${PEER}/profile.json`;
const text = (value: string) => new TextEncoder().encode(value);
const manifestFor = async (files: Map<string, Uint8Array>): Promise<Manifest> => ({
  format: 'runawaylog-files', formatVersion: 1, schemaVersion: 2, appVersion: 'test', deviceId: 'source', revision: '1',
  exportedAt: 0, kind: 'user', accountId: ACCOUNT, auth: { algorithm: null, keyId: null, signature: null },
  files: await Promise.all([...files].map(async ([path, bytes]) => ({
    path, module: moduleFor(path), schemaVersion: 1, fileVersion: '1', bytes: bytes.byteLength, sha256: await sha256(bytes),
  }))),
});
const zip = (files: Map<string, Uint8Array>, level: 0 | 6 = 6): Uint8Array => zipSync(Object.fromEntries(files), { level });
const fixture = async (files = new Map([[PROFILE, text('{"unknown":[null,"保留",7]}')]]), change?: (manifest: Manifest) => void) => {
  const manifest = await manifestFor(files);
  change?.(manifest);
  const entries = new Map([['manifest.json', encodeCanonical(manifest)], ...[...files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)]);
  return { manifest, entries, bytes: zip(entries) };
};
const headers = (bytes: Uint8Array) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = bytes.byteLength - 22, count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const central: number[] = [], local: number[] = [];
  for (let index = 0; index < count; index++) {
    central.push(offset);
    local.push(view.getUint32(offset + 42, true));
    offset += 46 + view.getUint16(offset + 28, true) + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
  }
  return { view, eocd, central, local };
};
const patch = (bytes: Uint8Array, mutate: (value: ReturnType<typeof headers>) => void) => {
  const result = new Uint8Array(bytes);
  mutate(headers(result));
  return result;
};
const streamingZip = (entries: Map<string, Uint8Array>, store = false): Uint8Array => {
  const chunks: Uint8Array[] = [];
  const archive = new Zip((error, bytes) => { if (error) throw error; chunks.push(bytes); });
  for (const [path, bytes] of entries) {
    const file = store ? new ZipPassThrough(path) : new ZipDeflate(path);
    file.os = 3;
    file.attrs = 0o100644 * 65536;
    archive.add(file);
    file.push(bytes, true);
  }
  archive.end();
  const result = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
};

describe('bounded format-1 ZIP decoder', () => {
  it.each([0, 6] as const)('decodes real STORE/DEFLATE archives with exact bytes and manifest membership (level %i)', async level => {
    const source = await fixture(new Map([[PROFILE, text(' {"n":-0, "unknown":[null,"保留"]} ')], [PEER_PROFILE, text('{}')]]));
    const result = await readArchive(zip(source.entries, level));
    expect(result.manifest).toEqual(source.manifest);
    expect([...result.files.keys()]).toEqual([...source.entries.keys()]);
    for (const [path, bytes] of source.entries) expect(result.files.get(path)).toEqual(bytes);
  });

  it.each([false, true])('accepts signed streaming data descriptors without scanning payload signatures (STORE=%s)', async store => {
    const source = await fixture(new Map([[PROFILE, text('{"marker":"PK\\u0007\\u0008 PK\\u0003\\u0004"}')]]));
    const result = await readArchive(streamingZip(source.entries, store));
    expect(result.files).toEqual(source.entries);
  });

  it('owns returned bytes across caller mutation and respects nonzero input view offsets', async () => {
    const source = await fixture();
    const padded = new Uint8Array(source.bytes.byteLength + 11);
    padded.set(source.bytes, 7);
    const view = padded.subarray(7, 7 + source.bytes.byteLength);
    const pending = readArchive(view);
    view.fill(0);
    expect((await pending).files).toEqual(source.entries);
  });

  it('rejects legacy JSON, wrong signatures, truncated archives and compressed cap before decoding', async () => {
    await expect(readArchive(text('{"schemaVersion":2,"users":{}}'))).rejects.toMatchObject({ code: 'zip' });
    const source = await fixture();
    await expect(readArchive(source.bytes.subarray(0, source.bytes.byteLength - 1))).rejects.toMatchObject({ code: 'zip' });
    await expect(readArchive(new Uint8Array(EXPORT_LIMITS.compressed + 1))).rejects.toMatchObject({ code: 'compressed-limit' });
  });

  it('bounds entry count and advertised manifest, payload and aggregate bytes before expansion', async () => {
    const source = await fixture();
    expect(() => preflightZip(patch(source.bytes, ({ view, eocd }) => {
      view.setUint16(eocd + 8, 10001, true); view.setUint16(eocd + 10, 10001, true);
    }))).toThrow(/10000/);
    for (const [index, size, code] of [[0, EXPORT_LIMITS.manifest + 1, 'manifest-limit'], [1, EXPORT_LIMITS.payload + 1, 'payload-limit']] as const) {
      await expect(readArchive(patch(source.bytes, ({ view, central }) => view.setUint32(central[index] + 24, size, true)))).rejects.toMatchObject({ code });
    }
    const entries = new Map(Array.from({ length: 16 }, (_, index) => [
      `accounts/${ACCOUNT}/imports/i-${String(index + 1).padStart(8, '0')}.json`, text('{}'),
    ]));
    const many = await fixture(entries);
    await expect(readArchive(patch(many.bytes, ({ view, central, local }) => {
      for (let index = 1; index < central.length; index++) {
        view.setUint32(central[index] + 24, EXPORT_LIMITS.payload, true);
        view.setUint32(local[index] + 22, EXPORT_LIMITS.payload, true);
      }
    }))).rejects.toMatchObject({ code: 'total-limit' });
  });

  it.each(['../manifest.json', '/manifest.json', 'C:/manifest.json', 'shared//extensions.json', 'shared/./extensions.json',
    'shared/../extensions.json', 'shared\\extensions.json', 'shared/%2e%2e/extensions.json', 'shared/%2Fextensions.json',
    'shared/\u0000extensions.json', 'shared/汉字.json', `accounts/${ACCOUNT}/plugins/unregistered.json`,
    `accounts/${ACCOUNT}/run/y2026-m11-000000.json`, 'shared/extensions.json/'])('rejects the original unsafe/unregistered raw path %j', async path => {
    const source = await fixture();
    const entries = new Map(source.entries);
    entries.delete(PROFILE);
    entries.set(path, text('{}'));
    await expect(readArchive(zip(entries))).rejects.toMatchObject({ code: 'path' });
  });

  it('bounds raw path bytes and rejects local/central name disagreement before manifest parsing', async () => {
    const source = await fixture(new Map([['x'.repeat(EXPORT_LIMITS.path + 1), text('{}')]]));
    await expect(readArchive(source.bytes)).rejects.toMatchObject({ code: 'path-limit' });
    const valid = await fixture();
    await expect(readArchive(patch(valid.bytes, ({ view, local }) => view.setUint8(local[1] + 39, 50)))).rejects.toMatchObject({ code: 'zip' });
  });

  it('rejects duplicate, unsorted, directory and manifest-not-first entries without normalizing', async () => {
    const source = await fixture(new Map([[PROFILE, text('{}')], [PEER_PROFILE, text('{}')]]));
    await expect(readArchive(zip(new Map([...source.entries].reverse())))).rejects.toMatchObject({ code: 'membership' });
    const unsorted = new Map([['manifest.json', source.entries.get('manifest.json')!], [PEER_PROFILE, text('{}')], [PROFILE, text('{}')]]);
    await expect(readArchive(zip(unsorted))).rejects.toMatchObject({ code: 'membership' });
    const duplicate = patch(source.bytes, ({ view, local, central }) => {
      // Both account ids have identical byte length. Duplicate one raw path in both headers.
      const pathBytes = text(PROFILE);
      for (let index = 0; index < pathBytes.length; index++) {
        view.setUint8(local[2] + 30 + index, pathBytes[index]);
        view.setUint8(central[2] + 46 + index, pathBytes[index]);
      }
    });
    await expect(readArchive(duplicate)).rejects.toMatchObject({ code: 'membership' });
  });

  it.each([
    ['encryption', 8, 6, 1], ['strong encryption', 8, 6, 64], ['unsupported encoding', 8, 6, 16],
    ['unsupported method', 10, 8, 99], ['ZIP64 version', 6, 4, 45],
  ] as const)('rejects %s in raw central/local headers', async (_name, centralField, localField, value) => {
    const source = await fixture();
    await expect(readArchive(patch(source.bytes, ({ view, central, local }) => {
      view.setUint16(central[1] + centralField, value, true); view.setUint16(local[1] + localField, value, true);
    }))).rejects.toThrow();
  });

  it('rejects symlinks, extra/Unicode override fields, ZIP64 sentinels and multi-disk ambiguity', async () => {
    const source = await fixture();
    await expect(readArchive(patch(source.bytes, ({ view, central }) => view.setUint32(central[1] + 38, 0o120777 * 65536, true)))).rejects.toMatchObject({ code: 'symlink' });
    await expect(readArchive(patch(source.bytes, ({ view, central }) => view.setUint16(central[1] + 30, 4, true)))).rejects.toMatchObject({ code: 'zip-extra' });
    await expect(readArchive(patch(source.bytes, ({ view, central }) => view.setUint32(central[1] + 20, 0xffffffff, true)))).rejects.toMatchObject({ code: 'zip64' });
    await expect(readArchive(patch(source.bytes, ({ view, eocd }) => view.setUint16(eocd + 4, 1, true)))).rejects.toMatchObject({ code: 'zip' });
  });

  it('rejects missing/unlisted payload membership, unsupported manifests and recovery kind', async () => {
    const source = await fixture();
    const missing = new Map(source.entries); missing.delete(PROFILE);
    await expect(readArchive(zip(missing))).rejects.toMatchObject({ code: 'membership' });
    const unlisted = new Map([...source.entries, ['shared/extensions.json', text('{}')]]);
    await expect(readArchive(zip(unlisted))).rejects.toMatchObject({ code: 'membership' });
    const unsupported = await fixture(undefined, manifest => { manifest.formatVersion = 2 as 1; });
    await expect(readArchive(unsupported.bytes)).rejects.toMatchObject({ code: 'manifest' });
    const recovery = await fixture(undefined, manifest => { manifest.kind = 'recovery'; manifest.accountId = null; });
    await expect(readArchive(recovery.bytes)).rejects.toMatchObject({ code: 'recovery' });
  });

  it('checks every exact payload hash before any payload JSON, including nonselected account', async () => {
    const malformedFirst = text('{not-json');
    const source = await fixture(new Map([[PROFILE, malformedFirst], [PEER_PROFILE, text('{}')]]), manifest => {
      manifest.files.find(file => file.path === PEER_PROFILE)!.sha256 = '0'.repeat(64);
    });
    await expect(readArchive(source.bytes)).rejects.toMatchObject({ code: 'integrity' });
    const malformedPeer = await fixture(new Map([[PROFILE, text('{}')], [PEER_PROFILE, text('{bad')]]));
    await expect(readArchive(malformedPeer.bytes)).rejects.toMatchObject({ code: 'json' });
    const length = await fixture(undefined, manifest => { manifest.files[0].bytes++; });
    await expect(readArchive(length.bytes)).rejects.toMatchObject({ code: 'integrity' });
  });

  it('enforces actual streamed manifest and payload caps despite false bounded advertised sizes', async () => {
    const source = await fixture();
    for (const manifestBomb of [true, false]) {
      const cap = manifestBomb ? EXPORT_LIMITS.manifest : EXPORT_LIMITS.payload;
      const bomb = new Uint8Array(cap + 1).fill(32);
      const entries = new Map(source.entries);
      const index = manifestBomb ? 0 : 1;
      entries.set(manifestBomb ? 'manifest.json' : PROFILE, bomb);
      if (!manifestBomb) {
        const manifest = { ...source.manifest, files: source.manifest.files.map(file => ({ ...file, bytes: cap })) };
        entries.set('manifest.json', encodeCanonical(manifest));
      }
      const bytes = patch(zip(entries), ({ view, central, local }) => {
        view.setUint32(central[index] + 24, cap, true); view.setUint32(local[index] + 22, cap, true);
      });
      await expect(readArchive(bytes)).rejects.toMatchObject({ code: manifestBomb ? 'manifest-limit' : 'payload-limit' });
    }
  }, 30000);

  it('accepts actual manifest/payload caps at exact equality without trusting an allocation hint', async () => {
    const payload = new Uint8Array(EXPORT_LIMITS.payload).fill(32);
    payload[0] = 123; payload[1] = 125;
    const source = await fixture(new Map([[PROFILE, payload]]));
    const manifestBytes = new Uint8Array(EXPORT_LIMITS.manifest).fill(32);
    manifestBytes.set(source.entries.get('manifest.json')!);
    source.entries.set('manifest.json', manifestBytes);
    const result = await readArchive(zip(source.entries));
    expect(result.files.get('manifest.json')!.byteLength).toBe(EXPORT_LIMITS.manifest);
    expect(result.files.get(PROFILE)!.byteLength).toBe(EXPORT_LIMITS.payload);
    expect(await sha256(result.files.get(PROFILE)!)).toBe(source.manifest.files[0].sha256);
  }, 30000);

  it('rejects false sizes, corrupt compressed bytes and inconsistent streaming descriptors', async () => {
    const source = await fixture();
    const crc = patch(source.bytes, ({ view, central, local }) => {
      view.setUint32(central[1] + 16, 0, true); view.setUint32(local[1] + 14, 0, true);
    });
    await expect(readArchive(crc)).rejects.toMatchObject({ code: 'integrity' });
    const broken = patch(source.bytes, ({ view, local }) => {
      const start = local[1] + 30 + view.getUint16(local[1] + 26, true);
      view.setUint8(start, 255);
    });
    await expect(readArchive(broken)).rejects.toThrow();
    const streamed = streamingZip(source.entries);
    const brokenDescriptor = patch(streamed, ({ view, central }) => {
      const directory = central[0];
      view.setUint32(directory - 4, 999, true);
    });
    await expect(readArchive(brokenDescriptor)).rejects.toMatchObject({ code: 'zip' });
  });

  it('refuses missing DEFLATE final blocks and trailing compressed bytes rather than trusting decoded SHA alone', async () => {
    const source = await fixture();
    const missingFinal = patch(source.bytes, ({ view, local }) => {
      const start = local[1] + 30 + view.getUint16(local[1] + 26, true);
      view.setUint8(start, view.getUint8(start) & 0xfe);
    });
    await expect(readArchive(missingFinal)).rejects.toMatchObject({ code: 'zip' });
    const info = headers(source.bytes);
    const directory = info.central[0];
    const trailing = new Uint8Array(source.bytes.byteLength + 1);
    trailing.set(source.bytes.subarray(0, directory));
    trailing[directory] = 0;
    trailing.set(source.bytes.subarray(directory), directory + 1);
    const view = new DataView(trailing.buffer);
    const payloadCentral = info.central[1] + 1;
    view.setUint32(info.local[1] + 18, info.view.getUint32(info.local[1] + 18, true) + 1, true);
    view.setUint32(payloadCentral + 20, info.view.getUint32(info.central[1] + 20, true) + 1, true);
    view.setUint32(info.eocd + 1 + 16, directory + 1, true);
    await expect(readArchive(trailing)).rejects.toMatchObject({ code: 'zip' });
  });

  it('allows depth 64 and rejects deeper, duplicate-key, NUL and invalid UTF-8 payloads after integrity', async () => {
    const exact = text('['.repeat(64) + '0' + ']'.repeat(64));
    expect((await readArchive((await fixture(new Map([[PROFILE, exact]]))).bytes)).files.get(PROFILE)).toEqual(exact);
    for (const [payload, code] of [
      [text('['.repeat(65) + '0' + ']'.repeat(65)), 'depth-limit'], [text('{"x":1,"x":2}'), 'json'],
      [text('{"x":"\\u0000"}'), 'json'], [new Uint8Array([0xff]), 'json'],
    ] as const) {
      await expect(readArchive((await fixture(new Map([[PROFILE, payload]]))).bytes)).rejects.toMatchObject({ code });
    }
  });
});
