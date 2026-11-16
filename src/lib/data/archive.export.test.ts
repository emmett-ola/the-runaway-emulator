// @vitest-environment node
import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import { encodeCanonical, decodeCanonical, sha256 } from '../../../shared/codec';
import type { FileDescriptor, Manifest, RecoverySnapshot, VirtualFile } from '../storage';
import { createExportArchive, createRecoveryArchive, type ArchiveSource } from './archive';
import { EXPORT_LIMITS, decodeExportJson, preflightExport, validateExportPath, validateManifest } from './validation';

// Node's actual SubtleCrypto, never an integrity stub.
if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const PEER = '22222222-2222-4222-8222-222222222222';
const ROOT = `accounts/${ACCOUNT}/`;
const moduleFor = (path: string) => path.includes('/run/') ? 'run' : path.includes('/plugins/') ? 'games' : path.split('/').at(-1)!.replace('.json', '');
const makeDescriptor = async (path: string, bytes: Uint8Array): Promise<FileDescriptor> => ({
  path, module: moduleFor(path), schemaVersion: 1, fileVersion: '3', bytes: bytes.byteLength, sha256: await sha256(bytes),
});
const envelope = (accountId: string, payload: unknown) => ({ accountId, payload, schemaVersion: 1, recordVersion: '3', createdAt: 0, updatedAt: 1 });
const fixture = async (change?: (files: Map<string, Uint8Array>) => void) => {
  const files = new Map<string, Uint8Array>();
  const put = (path: string, value: unknown) => files.set(path, encodeCanonical(value));
  put('shared/accounts.json', { schemaVersion: 1, recordVersion: '3', accounts: [
    { accountId: ACCOUNT, handle: 'selected/../handle', registeredAt: 0, ignoredUnknown: 'do not project' },
    { accountId: PEER, handle: 'peer', registeredAt: 1 },
  ], ignoredUnknown: 'peer installation directory extras' });
  put('shared/extensions.json', { schemaVersion: 1, payload: [null, 1, { opaque: true }] });
  put('shared/export-metadata.json', { schemaVersion: 1, payload: { note: 'interchange' } });
  put('device/preferences.json', { schemaVersion: 1, payload: { timezone: 'UTC', language: 'en_us', mode: 'local' } });
  for (const id of [ACCOUNT, PEER]) {
    const root = `accounts/${id}/`;
    put(root + 'account.json', envelope(id, { handle: id === ACCOUNT ? 'selected/../handle' : 'peer', registeredAt: id === ACCOUNT ? 0 : 1 }));
    for (const name of ['profile.json', 'settings.json', 'extensions.json', 'plugins/games.json', 'run/index.json', 'imports/index.json']) put(root + name, envelope(id, {}));
    put(root + 'run/y2026-m11-000001.json', { ...envelope(id, {}), partition: 'y2026-m11', sequence: 1,
      entries: [{ ordinal: 0, hit: { id: 'stable', at: 42, extra: ['保留', null, { x: -0 }] } }, { ordinal: 1, hit: { id: 'latest', at: 100 } }] });
  }
  change?.(files);
  const descriptors: FileDescriptor[] = [];
  for (const [path, bytes] of files) descriptors.push(await makeDescriptor(path, bytes));
  const manifest: Manifest = { format: 'runawaylog-files', formatVersion: 1, schemaVersion: 2, appVersion: 'old-app-version',
    deviceId: 'device-provenance', revision: '3', exportedAt: 0, kind: 'user', accountId: null,
    auth: { algorithm: null, keyId: null, signature: null }, files: descriptors.reverse() };
  const manifestBytes = encodeCanonical(manifest);
  files.set('manifest.json', manifestBytes);
  const requested: string[][] = [];
  const source: ArchiveSource = {
    manifest: manifestBytes, manifestDigest: await sha256(manifestBytes), revision: '3', paths: [...files.keys()].reverse(),
    files: async function* (paths) {
      requested.push([...paths]);
      // Unordered first-pass stream is valid. ZIP output must still be sorted.
      for (const path of [...paths].reverse()) if (files.has(path)) yield { path, bytes: files.get(path)! };
    },
  };
  return { source, files, requested, manifest };
};
const manifestOf = (zip: Record<string, Uint8Array>) => validateManifest(decodeCanonical(zip['manifest.json']));
const fakeDescriptor = (path = ROOT + 'extensions.json', bytes = 1): FileDescriptor => ({
  path, bytes, module: moduleFor(path), fileVersion: '1', schemaVersion: 1, sha256: 'a'.repeat(64),
});
const recovery = (files: VirtualFile[]): RecoverySnapshot => ({
  diagnostics: [{ code: 'integrity', message: 'Newest committed bytes failed verification.' }],
  current: { generation: 'damaged', revision: '9', manifestDigest: '0'.repeat(64) }, readableGeneration: 'older', readOnly: true, files,
});

describe('format-1 committed account export', () => {
  it('uses real SHA-256 and emits canonical manifest first, sorted isolated paths and exact committed bytes', async () => {
    const { source, files, requested } = await fixture();
    const bytes = await createExportArchive(source, 'selected/../handle', 123456);
    const zip = unzipSync(bytes);
    const paths = Object.keys(zip);
    expect(paths[0]).toBe('manifest.json');
    expect(paths.slice(1)).toEqual(paths.slice(1).sort());
    expect(paths.every(path => !path.endsWith('/') && !path.includes(PEER))).toBe(true);
    expect(paths).toContain(ROOT + 'run/y2026-m11-000001.json');
    expect(requested.flat().some(path => path.includes(PEER))).toBe(false);
    const manifest = manifestOf(zip);
    expect(manifest).toMatchObject({ kind: 'user', accountId: ACCOUNT, deviceId: 'device-provenance', revision: '3', exportedAt: 123456,
      auth: { algorithm: null, keyId: null, signature: null } });
    expect(manifest.appVersion).not.toBe('old-app-version');
    expect(manifest.files.map(file => file.path)).toEqual(paths.slice(1));
    expect(manifest.files.some(file => file.path === 'manifest.json')).toBe(false);
    for (const descriptor of manifest.files) {
      expect(descriptor.bytes).toBe(zip[descriptor.path].byteLength);
      expect(descriptor.sha256).toBe(await sha256(zip[descriptor.path]));
      if (descriptor.path !== 'shared/accounts.json') expect(zip[descriptor.path]).toEqual(files.get(descriptor.path));
    }
    expect(decodeCanonical(zip['shared/accounts.json'])).toEqual({ schemaVersion: 1, recordVersion: '3',
      accounts: [{ accountId: ACCOUNT, handle: 'selected/../handle', registeredAt: 0 }] });
    const chunk = decodeCanonical(zip[ROOT + 'run/y2026-m11-000001.json']);
    expect(chunk).toEqual(decodeCanonical(files.get(ROOT + 'run/y2026-m11-000001.json')!));
  });

  it('has deterministic ZIP bytes, fixed DOS timestamp and regular-file permissions without ZIP64', async () => {
    const { source } = await fixture();
    const first = await createExportArchive(source, 'selected/../handle', 12);
    expect(await createExportArchive(source, 'selected/../handle', 12)).toEqual(first);
    const view = new DataView(first.buffer, first.byteOffset, first.byteLength);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint16(10, true)).toBe(0);
    expect(view.getUint16(12, true)).toBe(33);
    const eocd = first.byteLength - 22;
    expect(view.getUint32(eocd, true)).toBe(0x06054b50);
    const count = view.getUint16(eocd + 10, true);
    expect(count).toBe(Object.keys(unzipSync(first)).length);
    let central = view.getUint32(eocd + 16, true);
    for (let i = 0; i < count; i++) {
      expect(view.getUint32(central, true)).toBe(0x02014b50);
      expect(view.getUint16(central + 6, true)).toBeLessThan(45);
      expect(view.getUint16(central + 8, true) & 1).toBe(0); // no encryption
      expect([0, 8]).toContain(view.getUint16(central + 10, true));
      expect(view.getUint32(central + 38, true) >>> 16).toBe(0o100644);
      expect(view.getUint16(central + 30, true)).toBe(0); // no extra/ZIP64 metadata
      central += 46 + view.getUint16(central + 28, true) + view.getUint16(central + 30, true) + view.getUint16(central + 32, true);
    }
  });

  it('rejects stale or corrupted manifest digests and generation membership', async () => {
    const { source } = await fixture();
    await expect(createExportArchive({ ...source, manifestDigest: 'f'.repeat(64) }, 'selected/../handle')).rejects.toMatchObject({ code: 'integrity' });
    await expect(createExportArchive({ ...source, revision: '2' }, 'selected/../handle')).rejects.toMatchObject({ code: 'manifest' });
    await expect(createExportArchive({ ...source, paths: [...source.paths, 'secret/session.json'] }, 'selected/../handle')).rejects.toMatchObject({ code: 'membership' });
  });

  it('rejects mutated bytes, missing payloads and duplicated iterator results without returning a partial archive', async () => {
    const { source, files } = await fixture();
    files.set(ROOT + 'profile.json', encodeCanonical(envelope(ACCOUNT, { changedAfterCommit: true })));
    await expect(createExportArchive(source, 'selected/../handle')).rejects.toMatchObject({ code: 'integrity' });
    files.delete(ROOT + 'profile.json');
    await expect(createExportArchive(source, 'selected/../handle')).rejects.toMatchObject({ code: 'missing-file' });
    const duplicate: ArchiveSource = { ...source, files: async function* (paths) {
      for await (const file of source.files(paths)) { yield file; yield file; }
    } };
    await expect(createExportArchive(duplicate, 'selected/../handle')).rejects.toMatchObject({ code: 'membership' });
  });

  it('rechecks exact bytes during ZIP pass and refuses a source changing after preflight', async () => {
    const { source } = await fixture();
    let profileReads = 0;
    const changing: ArchiveSource = { ...source, files: async function* (paths) {
      for await (const file of source.files(paths)) {
        if (file.path === ROOT + 'profile.json' && ++profileReads > 1) yield { path: file.path, bytes: encodeCanonical(envelope(ACCOUNT, 'changed')) };
        else yield file;
      }
    } };
    await expect(createExportArchive(changing, 'selected/../handle')).rejects.toMatchObject({ code: 'integrity' });
  });

  it('requires selected identity agreement and does not silently use a UI fallback', async () => {
    const { source } = await fixture();
    await expect(createExportArchive(source, 'missing-ui-user')).rejects.toMatchObject({ code: 'account' });
    const wrongOwner = await fixture(files => files.set(ROOT + 'profile.json', encodeCanonical(envelope(PEER, {}))));
    await expect(createExportArchive(wrongOwner.source, 'selected/../handle')).rejects.toMatchObject({ code: 'account' });
    const wrongHandle = await fixture(files => files.set(ROOT + 'account.json', encodeCanonical(envelope(ACCOUNT, { handle: 'stale', registeredAt: 0 }))));
    await expect(createExportArchive(wrongHandle.source, 'selected/../handle')).rejects.toMatchObject({ code: 'account' });
    const missing = await fixture(files => files.delete(ROOT + 'imports/index.json'));
    await expect(createExportArchive(missing.source, 'selected/../handle')).rejects.toMatchObject({ code: 'missing-file' });
  });

  it('supports an empty account with zero chunks and excludes unregistered credential paths', async () => {
    const empty = await fixture(files => {
      files.delete(ROOT + 'run/y2026-m11-000001.json');
      files.set('credentials/session.json', encodeCanonical({ token: 'must-not-export' }));
    });
    await expect(createExportArchive(empty.source, 'selected/../handle')).rejects.toMatchObject({ code: 'path' });
    const valid = await fixture(files => files.delete(ROOT + 'run/y2026-m11-000001.json'));
    const zip = unzipSync(await createExportArchive(valid.source, 'selected/../handle'));
    expect(Object.keys(zip).filter(path => path.startsWith(ROOT + 'run/'))).toEqual([ROOT + 'run/index.json']);
  });
});

describe('export envelope preflight', () => {
  it('allows equality and rejects the next byte or entry for every declared envelope cap', () => {
    const payload = fakeDescriptor();
    expect(() => preflightExport([{ ...payload, bytes: EXPORT_LIMITS.payload }], EXPORT_LIMITS.manifest)).not.toThrow();
    expect(() => preflightExport([{ ...payload, bytes: EXPORT_LIMITS.payload + 1 }], 0)).toThrow(/16 MiB/);
    expect(() => preflightExport([payload], EXPORT_LIMITS.manifest + 1)).toThrow(/4 MiB/);
    const entries = Array.from({ length: EXPORT_LIMITS.entries - 1 }, (_, i) => fakeDescriptor(ROOT + `imports/i-${String(i + 1).padStart(8, '0')}.json`));
    expect(() => preflightExport(entries, 0)).not.toThrow();
    expect(() => preflightExport([...entries, fakeDescriptor(ROOT + 'profile.json')], 0)).toThrow(/10000/);
    const total = Array.from({ length: 16 }, (_, i) => fakeDescriptor(ROOT + `imports/i-${String(i + 1).padStart(8, '0')}.json`, EXPORT_LIMITS.payload));
    expect(() => preflightExport(total, 0)).not.toThrow();
    expect(() => preflightExport(total, 1)).toThrow(/256 MiB/);
    expect(() => preflightExport([payload, payload], 0)).toThrow(/duplicate/);
  });

  it.each(['../manifest.json', '/manifest.json', 'C:/manifest.json', 'shared//accounts.json', 'shared/./accounts.json',
    'shared/../accounts.json', 'shared\\accounts.json', 'shared/%2e%2e/accounts.json', 'shared/%2Faccounts.json',
    'shared/\u0000accounts.json', 'shared/汉字.json', ROOT + 'plugins/unregistered.json', ROOT + 'run/y2026-m11-000000.json'])('rejects raw unsafe/unregistered path %j', path => {
    expect(() => validateExportPath(path)).toThrow();
  });

  it('bounds ASCII path bytes and JSON depth, counting no brackets inside quoted strings', () => {
    expect(() => validateExportPath('a'.repeat(EXPORT_LIMITS.path + 1))).toThrow(/4096/);
    const prefix = ROOT + 'run/y';
    const suffix = '-m11-000001.json';
    const exact = prefix + '1'.repeat(EXPORT_LIMITS.path - prefix.length - suffix.length) + suffix;
    expect(() => validateExportPath(exact)).not.toThrow();
    const encode = (text: string) => new TextEncoder().encode(text);
    expect(() => decodeExportJson(encode('['.repeat(64) + '0' + ']'.repeat(64)))).not.toThrow();
    expect(() => decodeExportJson(encode('['.repeat(65) + '0' + ']'.repeat(65)))).toThrow(/64 nesting/);
    const quotedBrackets = '[{\\' + '"';
    expect(decodeExportJson(encode(JSON.stringify({ text: quotedBrackets.repeat(100) })))).toEqual({ text: quotedBrackets.repeat(100) });
    expect(() => decodeExportJson(encode('{"duplicate":1,"duplicate":2}'))).toThrow(/run-json-1/);
    expect(() => decodeExportJson(encode('{"bad":1e999}'))).toThrow(/run-json-1/);
  });

  it('refuses too-deep or oversized actual selected payloads before encoding a ZIP', async () => {
    const deep = await fixture(files => files.set(ROOT + 'profile.json', new TextEncoder().encode('['.repeat(65) + '0' + ']'.repeat(65))));
    await expect(createExportArchive(deep.source, 'selected/../handle')).rejects.toMatchObject({ code: 'depth-limit' });
    const large = await fixture(files => files.set(ROOT + 'profile.json', new Uint8Array(EXPORT_LIMITS.payload + 1)));
    await expect(createExportArchive(large.source, 'selected/../handle')).rejects.toMatchObject({ code: 'payload-limit' });
  });
});

describe('raw damaged-byte rescue export', () => {
  it('registers UUID binary evidence with hashes and explicit diagnostics/multi-account warning', async () => {
    const first = new Uint8Array([0, 255, 123, 1]);
    const second = new TextEncoder().encode('{damaged json');
    const zip = unzipSync(await createRecoveryArchive(recovery([
      { path: ROOT + 'profile.json', bytes: first }, { path: `accounts/${PEER}/profile.json`, bytes: second },
    ]), 77));
    const manifest = manifestOf(zip);
    expect(manifest).toMatchObject({ kind: 'recovery', accountId: null, exportedAt: 77, revision: '9', deviceId: 'unavailable' });
    const rawPaths = Object.keys(zip).filter(path => path.startsWith('recovery/'));
    expect(rawPaths).toHaveLength(2);
    for (const path of rawPaths) expect(path).toMatch(/^recovery\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.bin$/);
    const metadata = decodeCanonical(zip['shared/export-metadata.json']) as { warning: string; files: { originalPath: string; recoveryPath: string }[]; diagnostics: unknown[] };
    expect(metadata.warning).toMatch(/multiple accounts/);
    expect(metadata.warning).toMatch(/Not an ordinary account import/);
    expect(metadata.diagnostics).toEqual(recovery([]).diagnostics);
    expect(zip[metadata.files[0].recoveryPath]).toEqual(first);
    expect(zip[metadata.files[1].recoveryPath]).toEqual(second);
    for (const file of manifest.files) expect(await sha256(zip[file.path])).toBe(file.sha256);
  });

  it('reports inaccessible or oversized rescue rather than truncating evidence', async () => {
    await expect(createRecoveryArchive(recovery([]))).rejects.toMatchObject({ code: 'recovery-unavailable' });
    await expect(createRecoveryArchive(recovery([{ path: 'damaged', bytes: new Uint8Array(EXPORT_LIMITS.payload + 1) }]))).rejects.toThrow(/Raw recovery export refused:.*16 MiB.*Original evidence was not changed/);
  });

  it('counts real streaming ZIP bytes and refuses the final compressed limit before producing an archive', async () => {
    // STORE evidence exercises the actual compressor/output counter, not advertised descriptor sizes.
    const payload = new Uint8Array(EXPORT_LIMITS.payload);
    const files = Array.from({ length: 4 }, (_, i) => ({ path: `damaged-${i}`, bytes: payload }));
    await expect(createRecoveryArchive(recovery(files))).rejects.toMatchObject({ code: 'compressed-limit' });
  }, 30000);
});
