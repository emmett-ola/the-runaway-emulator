// @vitest-environment node
import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decodeCanonical, encodeCanonical, sha256 } from '../../../shared/codec';
import { decodeImportSources, encodeImportSource, IMPORT_SOURCE_CODEC, IMPORT_SOURCE_LIMITS, sourceKey, validateLogicalSource } from './source-codec';

if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const PEER = '22222222-2222-4222-8222-222222222222';
const source = () => ({ accountId: ACCOUNT, files: { 'extensions.json': { payload: [null, false, 0, '保留'], presence: { email: false } } }, shared: { 'shared/extensions.json': { opaque: 'keep' } } });
const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');
const wire = (value: unknown): unknown => {
  if (!value || typeof value !== 'object' || !('files' in value) || !('shared' in value) || !('accountId' in value)) return value;
  const files = value.files, shared = value.shared;
  if (!files || !shared || typeof files !== 'object' || typeof shared !== 'object' || Array.isArray(files) || Array.isArray(shared)) return value;
  return { ...value, accountId: value.accountId, codec: 'run-json-1/file-strings',
    files: Object.fromEntries(Object.entries(files).map(([path, item]) => [path, new TextDecoder().decode(encodeCanonical(item))])),
    shared: Object.fromEntries(Object.entries(shared).map(([path, item]) => [path, new TextDecoder().decode(encodeCanonical(item))])),
  };
};
const partGroup = async (value: unknown, slices = 2, accountId = ACCOUNT) => {
  const bytes = encodeCanonical(wire(value));
  const sourceDigest = await sha256(bytes);
  return Array.from({ length: slices }, (_, part) => ({ accountId, codec: IMPORT_SOURCE_CODEC, sourceDigest, part, totalParts: slices,
    data: base64(bytes.subarray(Math.floor(part * bytes.length / slices), Math.floor((part + 1) * bytes.length / slices))) }));
};
const rejects = (payloads: readonly unknown[]) => expect(decodeImportSources(payloads)).rejects.toMatchObject({ code: 'import-source' });

describe('bounded flat import source codec', () => {
  it('keeps ordinary logical sources unchanged and preserves scalar/null/array/presence values and source order', async () => {
    const original = source();
    expect((await encodeImportSource(original))[0]).toBe(original);
    const peer = { ...source(), accountId: PEER };
    const decoded = await decodeImportSources([original, peer]);
    expect(decoded).toEqual([original, peer]);
    expect(decoded[0]).toBe(original);
    expect(await decodeImportSources([])).toEqual([]);
  });
  it('keeps exact 12 MiB canonical equality inline and fragments the next byte into <=8 MiB binary parts', async () => {
    const original = { accountId: ACCOUNT, files: { 'extensions.json': '' }, shared: {} };
    const overhead = encodeCanonical(original).byteLength;
    original.files['extensions.json'] = 'x'.repeat(IMPORT_SOURCE_LIMITS.inline - overhead);
    expect(encodeCanonical(original)).toHaveLength(IMPORT_SOURCE_LIMITS.inline);
    expect(await encodeImportSource(original)).toEqual([original]);
    original.files['extensions.json'] += 'x';
    const encoded = await encodeImportSource(original);
    expect(encoded).toHaveLength(2);
    const expectedDigest = await sha256(encodeCanonical(wire(original)));
    for (const [index, value] of encoded.entries()) {
      expect(value).toMatchObject({ accountId: ACCOUNT, codec: IMPORT_SOURCE_CODEC, sourceDigest: expectedDigest, part: index, totalParts: 2 });
      expect(encodeCanonical(value).byteLength).toBeLessThan(IMPORT_SOURCE_LIMITS.payload);
      const data = (value as { data: string }).data;
      expect(Buffer.from(data, 'base64').byteLength).toBeLessThanOrEqual(IMPORT_SOURCE_LIMITS.part);
    }
    expect(await decodeImportSources(encoded)).toEqual([original]);
  }, 30000);
  it('joins binary parts before UTF-8 decoding so a split multibyte character remains exact', async () => {
    const original = source();
    const bytes = encodeCanonical(wire(original));
    const split = bytes.findIndex(byte => byte === 0xe4) + 1;
    expect(split).toBeGreaterThan(0);
    const digest = await sha256(bytes);
    const parts = [bytes.subarray(0, split), bytes.subarray(split)].map((value, part) => ({
      accountId: ACCOUNT, codec: IMPORT_SOURCE_CODEC, sourceDigest: digest, part, totalParts: 2, data: base64(value),
    }));
    expect(await decodeImportSources(parts)).toEqual([original]);
  });
  it('preserves adjacent source ordering without merging distinct owners or flattening opaque payload arrays', async () => {
    const first = source(), second = { ...source(), accountId: PEER };
    const fragmented = await partGroup(second, 2, PEER);
    expect(await decodeImportSources([first, ...fragmented])).toEqual([first, second]);
  });
  it('rejects missing, duplicate, reordered, interleaved and repeated fragment groups instead of salvaging them', async () => {
    const parts = await partGroup(source());
    await rejects([parts[0]]);
    await rejects([parts[1]]);
    await rejects([parts[0], parts[0]]);
    await rejects([parts[1], parts[0]]);
    await rejects([parts[0], source(), parts[1]]);
    await rejects([...parts, ...parts]);
  });
  it('rejects conflicting digest, owner, totalParts or out-of-range fragment metadata', async () => {
    const parts = await partGroup(source());
    for (const patch of [{ accountId: PEER }, { sourceDigest: '0'.repeat(64) }, { totalParts: 3 }, { part: 2 }]) {
      await rejects([parts[0], { ...parts[1], ...patch }]);
    }
    await rejects(await partGroup(source(), 2, PEER));
  });
  it.each([
    { codec: 'other-codec' }, { codec: undefined }, { sourceDigest: 'bad' }, { sourceDigest: 'A'.repeat(64) },
    { accountId: 'handle-not-uuid' }, { part: -1 }, { part: 0.5 }, { part: '0' },
    { totalParts: 0 }, { totalParts: 33 }, { totalParts: Number.MAX_SAFE_INTEGER }, { totalParts: '2' },
    { data: 42 }, { data: '' }, { unknownMarkerField: true },
  ])('rejects malformed fragment marker %j', async patch => {
    const parts = await partGroup(source());
    await rejects([{ ...parts[0], ...patch }, parts[1]]);
  });
  it.each(['*AAA', 'A===', 'AA=A', 'A', 'AAAA\n', 'AB==', 'AAB='])('rejects invalid or noncanonical base64 %j before source parsing', async data => {
    const parts = await partGroup(source());
    await rejects([{ ...parts[0], data }, parts[1]]);
  });
  it('rejects corrupted part bytes even when the base64 grammar is valid', async () => {
    const parts = await partGroup(source());
    const corrupt = Buffer.from(parts[1].data, 'base64');
    corrupt[0] ^= 1;
    await rejects([parts[0], { ...parts[1], data: corrupt.toString('base64') }]);
  });
  it('rejects encoded and decoded part caps before allocating an oversized binary source', async () => {
    const parts = await partGroup(source());
    const overEncoded = 'A'.repeat(Math.ceil(IMPORT_SOURCE_LIMITS.part / 3) * 4 + 4);
    await rejects([{ ...parts[0], data: overEncoded }, parts[1]]);
    // 8 MiB+1 has the same padded base64 length as 8 MiB; decoded size must be checked too.
    const overDecoded = base64(new Uint8Array(IMPORT_SOURCE_LIMITS.part + 1));
    expect(overDecoded.length).toBe(Math.ceil(IMPORT_SOURCE_LIMITS.part / 3) * 4);
    await rejects([{ ...parts[0], data: overDecoded }, parts[1]]);
  });
  it('rejects oversized inline provenance instead of silently storing an unexportable ordinary payload', async () => {
    const oversized = { accountId: ACCOUNT, files: { 'extensions.json': 'x'.repeat(IMPORT_SOURCE_LIMITS.payload) }, shared: {} };
    await rejects([oversized]);
  }, 30000);
  it.each([
    null, [], { accountId: ACCOUNT, files: {}, shared: {}, importBackups: [] },
    { accountId: 'other', files: {}, shared: {} }, { accountId: ACCOUNT, files: [], shared: {} },
    { accountId: ACCOUNT, files: {}, shared: [] },
    { accountId: ACCOUNT, files: { 'imports/i-00000001.json': {} }, shared: {} },
    { accountId: ACCOUNT, files: { 'imports/index.json': {} }, shared: {} },
    { accountId: ACCOUNT, files: { '../extensions.json': {} }, shared: {} },
    { accountId: ACCOUNT, files: { 'run/y2026-m11-000000.json': {} }, shared: {} },
    { accountId: ACCOUNT, files: { 'plugins/unknown.json': {} }, shared: {} },
    { accountId: ACCOUNT, files: {}, shared: { 'shared/accounts.json': {} } },
    { accountId: ACCOUNT, files: {}, shared: { 'device/../preferences.json': {} } },
  ])('rejects nonflat or unregistered logical source %j', async value => {
    expect(() => validateLogicalSource(value)).toThrow();
    await rejects([value]);
    await rejects(await partGroup(value));
  });
  it('rejects unsupported JSON values and depth over 64 for inline and fragmented source documents', async () => {
    const unsupported = { ...source(), files: { 'extensions.json': { notJson: undefined } } };
    await expect(encodeImportSource(unsupported)).rejects.toMatchObject({ code: 'import-source' });
    await rejects([unsupported]);
    const depth = new TextEncoder().encode(`{"accountId":"${ACCOUNT}","files":{"extensions.json":` + '['.repeat(64) + '0' + ']'.repeat(64) + '},"shared":{}}');
    const data = base64(depth);
    await rejects([{ accountId: ACCOUNT, codec: IMPORT_SOURCE_CODEC, sourceDigest: await sha256(depth), part: 0, totalParts: 1, data }]);
  });
  it('rejects reassembled invalid UTF-8, duplicate keys and invalid source shapes despite matching SHA-256', async () => {
    const bytes = [new Uint8Array([0xff]), new TextEncoder().encode('{"accountId":"a","accountId":"b"}'), encodeCanonical({ wrapper: source() })];
    for (const value of bytes) await rejects([{ accountId: ACCOUNT, codec: IMPORT_SOURCE_CODEC, sourceDigest: await sha256(value), part: 0, totalParts: 1, data: base64(value) }]);
  });
  it('rejects invalid original file strings inside a correctly hashed shallow wire document', async () => {
    const originals = ['['.repeat(65) + '0' + ']'.repeat(65), '{"duplicate":1,"duplicate":2}', '{"notFinite":1e999}', '{"nul":"\\u0000"}'];
    for (const text of originals) {
      const bytes = encodeCanonical({ accountId: ACCOUNT, codec: 'run-json-1/file-strings', files: { 'extensions.json': text }, shared: {} });
      await rejects([{ accountId: ACCOUNT, codec: IMPORT_SOURCE_CODEC, sourceDigest: await sha256(bytes), part: 0, totalParts: 1, data: base64(bytes) }]);
    }
    const nonstring = encodeCanonical({ accountId: ACCOUNT, codec: 'run-json-1/file-strings', files: { 'extensions.json': 0 }, shared: {} });
    await rejects([{ accountId: ACCOUNT, codec: IMPORT_SOURCE_CODEC, sourceDigest: await sha256(nonstring), part: 0, totalParts: 1, data: base64(nonstring) }]);
  });
  it('preserves exact depth-64 original files through one-part wire encoding without spending wrapper depth', async () => {
    const deepest = decodeCanonical('['.repeat(64) + '0' + ']'.repeat(64));
    const original = { accountId: ACCOUNT, files: { 'extensions.json': deepest }, shared: {} };
    expect(() => encodeCanonical(original)).toThrow();
    expect(() => validateLogicalSource(original)).not.toThrow();
    const encoded = await encodeImportSource(original);
    expect(encoded).toHaveLength(1);
    expect(encoded[0]).toMatchObject({ codec: IMPORT_SOURCE_CODEC, part: 0, totalParts: 1 });
    const decoded = await decodeImportSources(encoded);
    expect(decoded).toEqual([original]);
    expect(sourceKey(decoded[0])).toBe(sourceKey(original));
    const tooDeep = { accountId: ACCOUNT, files: { 'extensions.json': [deepest] }, shared: {} };
    await expect(encodeImportSource(tooDeep)).rejects.toMatchObject({ code: 'import-source' });
  });
  it('fragments a source whose own depth fits but the required import envelope would exceed depth 64', async () => {
    const deepest = decodeCanonical('['.repeat(62) + '0' + ']'.repeat(62));
    const original = { accountId: ACCOUNT, files: { 'extensions.json': deepest }, shared: {} };
    expect(() => encodeCanonical(original)).not.toThrow();
    expect(() => encodeCanonical({ payload: original })).toThrow();
    const encoded = await encodeImportSource(original);
    expect(encoded[0]).toMatchObject({ codec: IMPORT_SOURCE_CODEC });
    expect(await decodeImportSources(encoded)).toEqual([original]);
  });
  it('creates deterministic source keys independent of object-key order and retains array order', () => {
    const original = source();
    const reordered = { shared: original.shared, files: original.files, accountId: original.accountId };
    expect(sourceKey(original)).toBe(sourceKey(reordered));
    expect(sourceKey(original)).not.toBe(sourceKey({ ...original, files: { 'extensions.json': { payload: [false, null, 0, '保留'], presence: { email: false } } } }));
  });
  it('validates a canonical source after binary reassembly without accepting nested transport wrappers', async () => {
    const original = source();
    const parts = await partGroup(original);
    expect(await decodeImportSources(parts)).toEqual([decodeCanonical(encodeCanonical(original))]);
    await rejects(await partGroup({ accountId: ACCOUNT, files: {}, shared: {}, parts }));
  });
});
