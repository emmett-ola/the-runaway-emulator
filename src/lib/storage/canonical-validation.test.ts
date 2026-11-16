import { describe, expect, it } from 'vitest';
import { decodeCanonical, encodeCanonical, sha256 } from '../../../shared/codec';
import { appendHit, createAccount, getAccountSnapshot, getStorageState, initializeStorage, readFullRecord, resetStorage } from './index';
import { appendChunk, emptyIndex, validateChunk, validateHit } from './chunks';
import { accountPath, makeBlob, readFile } from './files';
import { completed, getGeneration, openDatabase, readBlob, readCurrent, transaction } from './idb';
import { validateCanonicalFiles, validateCanonicalTree } from './tree-validation';
import type { Chunk, Envelope, Manifest, RunIndex } from './state-model';

const hit = { id: 'canonical', at: 0, schemaVersion: 1, recordVersion: '1' };
const account = async (handle = 'canonical') => (await createAccount(handle)).accountId!;
const tree = async () => {
  const generation = await getGeneration((await readCurrent())!.generation);
  const files = new Map<string, Uint8Array>();
  for (const [path, id] of Object.entries(generation.map)) files.set(path, new Uint8Array((await readBlob(id)).bytes));
  return { manifest: await readFile<Manifest>(generation, 'manifest.json'), files };
};
const rewrite = async (manifest: Manifest, files: Map<string, Uint8Array>, path: string, value: unknown) => {
  const bytes = encodeCanonical(value);
  files.set(path, bytes);
  const descriptor = manifest.files.find(file => file.path === path)!;
  descriptor.bytes = bytes.byteLength; descriptor.sha256 = await sha256(bytes);
  files.set('manifest.json', encodeCanonical(manifest));
};
const malformed = [
  { id: 'canonical', at: 0 }, { ...hit, schemaVersion: undefined }, { ...hit, schemaVersion: 2 },
  { ...hit, schemaVersion: '1' }, { ...hit, recordVersion: undefined }, { ...hit, recordVersion: 1 },
  { ...hit, recordVersion: '' }, { ...hit, recordVersion: '0' }, { ...hit, recordVersion: '-1' },
  { ...hit, recordVersion: '01' }, { ...hit, recordVersion: '1.0' }, { ...hit, recordVersion: ' 1' },
];

describe('canonical storage boundaries', () => {
  it('rejects missing or malformed hit metadata in validators and public append without publishing or normalizing', async () => {
    const id = await account(), before = await readCurrent();
    for (const invalid of malformed) {
      const unchanged = structuredClone(invalid);
      expect(() => validateHit(invalid)).toThrow();
      await expect(appendChunk(id, emptyIndex(id, '2'), invalid, null, '2')).rejects.toThrow();
      await expect(appendHit(id, invalid)).rejects.toThrow();
      expect(await readCurrent()).toEqual(before);
      expect(getAccountSnapshot(id)?.total).toBe(0);
      expect(invalid).toEqual(unchanged);
    }
    await appendHit(id, hit);
    expect((await readFullRecord(id)).hits).toEqual([hit]);
  });

  it('blocks boot and queued writes on rehashed malformed directory and entity metadata without replacing current', async () => {
    const id = await account(), original = await tree(), root = accountPath(id);
    const generation = await getGeneration((await readCurrent())!.generation), pointer = (await readCurrent())!;
    const install = async (manifest: Manifest, files: Map<string, Uint8Array>) => {
      const blobs = [];
      for (const [path, bytes] of files) {
        const previous = await readBlob(generation.map[path]);
        blobs.push({ ...previous, bytes, length: bytes.byteLength, sha256: await sha256(bytes) });
      }
      const manifestDigest = await sha256(files.get('manifest.json')!);
      const tx = transaction(await openDatabase(), 'readwrite'), done = completed(tx);
      for (const blob of blobs) tx.objectStore('blobs').put(blob, blob.id);
      tx.objectStore('generations').put({ ...generation, manifestDigest }, generation.id);
      tx.objectStore('control').put({ ...pointer, manifestDigest }, 'current');
      await done;
      expect(manifest.revision).toBe(pointer.revision);
    };
    const cases: [string, (value: Record<string, unknown>) => unknown][] = [
      ...['shared/accounts.json', `${root}/extensions.json`, `${root}/imports/index.json`].map(path => [path, (value: Record<string, unknown>) => ({ ...value, recordVersion: 1 })] as [string, (value: Record<string, unknown>) => unknown]),
      ['manifest.json', value => ({ ...value, kind: 'recovery' })],
      ['manifest.json', value => ({ ...value, auth: { algorithm: 'unsupported', keyId: null, signature: null } })],
      ['manifest.json', value => ({ ...value, files: (value.files as object[]).map(file => ({ ...file, schemaVersion: 2 })) })],
      [`${root}/run/index.json`, value => ({ ...value, sourceRevision: '999999' })],
    ];
    for (const [path, mutate] of cases) {
      const manifest = structuredClone(original.manifest), files = new Map(original.files);
      const changed = mutate(decodeCanonical(files.get(path)!) as Record<string, unknown>);
      if (path === 'manifest.json') files.set(path, encodeCanonical(changed));
      else await rewrite(manifest, files, path, changed);
      await install(manifest, files);
      const damaged = await readCurrent();
      await expect(appendHit(id, { ...hit, id: 'blocked' })).rejects.toThrow();
      expect(getStorageState().status).toBe('blocked');
      expect(await readCurrent()).toEqual(damaged);
      await resetStorage();
      await expect(initializeStorage()).rejects.toThrow();
      expect(getStorageState().status).toBe('blocked');
      expect(await readCurrent()).toEqual(damaged);
      await install(original.manifest, original.files);
      await resetStorage(); await initializeStorage();
    }
  });

  it('preserves canonical hit versions and supported scalar array null and presence values exactly', async () => {
    const id = await account();
    const original = { ...hit, recordVersion: '999999999999999999999', scalar: false, list: [null, 2, '原始'], presence: { absent: false, explicit: null } };
    await appendHit(id, original);
    expect((await readFullRecord(id)).hits).toEqual([original]);
    const { manifest, files } = await tree();
    await expect(validateCanonicalTree(manifest, files)).resolves.toBeUndefined();
  });

  it('rejects unsupported unknown hit values and invalid id or timestamp facts without changing current', async () => {
    const id = await account(), before = await readCurrent();
    const invalid = [
      { ...hit, id: '' }, { ...hit, id: '\0' }, { ...hit, id: '\ud800' },
      { ...hit, at: 0.5 }, { ...hit, at: NaN }, { ...hit, at: 8_640_000_000_000_001 },
      { ...hit, unknown: undefined }, { ...hit, unknown: Infinity }, { ...hit, unknown: '\0' },
      { ...hit, unknown: new Date(0) }, { ...hit, unknown: 1n },
    ];
    for (const value of invalid) {
      await expect(appendHit(id, value)).rejects.toThrow();
      expect(await readCurrent()).toEqual(before);
    }
  });

  it('rejects malformed chunk entity metadata even when its hits and descriptor are valid', async () => {
    const id = crypto.randomUUID(), result = await appendChunk(id, emptyIndex(id, '1'), hit, null, '1');
    const chunk = decodeCanonical(result.blob.bytes) as unknown as Chunk;
    for (const patch of [{ schemaVersion: 2 }, { recordVersion: 1 }, { recordVersion: '0' }, { createdAt: 0.5 }, { updatedAt: Infinity }, { accountId: crypto.randomUUID() }]) {
      expect(() => validateChunk({ ...chunk, ...patch } as Chunk, result.index.chunks[0], id)).toThrow();
    }
    const badHit = { ...chunk, entries: [{ ordinal: 0, hit: { id: 'no-metadata', at: 0 } }] };
    expect(() => validateChunk(badHit, result.index.chunks[0], id)).toThrow();
  });
});

describe('whole canonical tree audit', () => {
  it('verifies all payload hashes before semantic parsing including nonselected accounts', async () => {
    const selected = await account(), other = await account('other');
    await appendHit(other, { ...hit, id: 'other-hit' });
    const { manifest, files } = await tree();
    manifest.accountId = selected;
    const malformedPath = 'shared/extensions.json', brokenPath = `${accountPath(other)}/run/y1970-m01-000001.json`;
    const malformedBytes = new TextEncoder().encode('{invalid JSON');
    files.set(malformedPath, malformedBytes);
    const descriptor = manifest.files.find(file => file.path === malformedPath)!;
    descriptor.bytes = malformedBytes.length; descriptor.sha256 = await sha256(malformedBytes);
    files.set(brokenPath, new Uint8Array([1])); files.set('manifest.json', encodeCanonical(manifest));
    await expect(validateCanonicalTree(manifest, files)).rejects.toThrow('SHA-256');
  });

  it('rejects rehashed malformed account metadata registration profile plugin and settings ownership', async () => {
    const id = await account(), original = await tree(), root = accountPath(id);
    const cases: [string, (value: Record<string, unknown>) => unknown][] = [
      [`${root}/account.json`, value => ({ ...value, recordVersion: 1 })],
      [`${root}/account.json`, value => ({ ...value, schemaVersion: 2 })],
      [`${root}/account.json`, value => ({ ...value, createdAt: 0.5 })],
      [`${root}/account.json`, value => ({ ...value, payload: { ...(value.payload as object), registeredAt: -1 } })],
      [`${root}/profile.json`, value => ({ ...value, payload: { fields: {}, emailVerification: 'verified' } })],
      [`${root}/profile.json`, value => ({ ...value, payload: { fields: {}, emailVerification: 'unverified', email: null } })],
      [`${root}/settings.json`, value => ({ ...value, payload: { timezone: 'UTC' } })],
      [`${root}/plugins/games.json`, value => ({ ...value, pluginId: 'unregistered' })],
      ['shared/accounts.json', value => ({ ...value, recordVersion: 1 })],
    ];
    for (const [path, mutate] of cases) {
      const manifest = structuredClone(original.manifest), files = new Map(original.files);
      await rewrite(manifest, files, path, mutate(decodeCanonical(files.get(path)!) as Record<string, unknown>));
      await expect(validateCanonicalTree(manifest, files)).rejects.toThrow();
    }
  });

  it('rejects exact map membership descriptor schema and unlisted account disagreements', async () => {
    const id = await account(), original = await tree();
    const missing = new Map(original.files); missing.delete(`${accountPath(id)}/profile.json`);
    await expect(validateCanonicalTree(original.manifest, missing)).rejects.toThrow('membership');
    const extra = new Map(original.files); extra.set('unregistered.json', encodeCanonical({}));
    await expect(validateCanonicalTree(original.manifest, extra)).rejects.toThrow('membership');
    for (const patch of [{ schemaVersion: 2 }, { fileVersion: 1 }, { fileVersion: '0' }, { module: 'unregistered' }]) {
      const manifest = structuredClone(original.manifest), files = new Map(original.files);
      Object.assign(manifest.files[0], patch); files.set('manifest.json', encodeCanonical(manifest));
      await expect(validateCanonicalTree(manifest, files)).rejects.toThrow();
    }
    const manifest = structuredClone(original.manifest), files = new Map(original.files), path = `${accountPath(crypto.randomUUID())}/extensions.json`;
    const blob = await makeBlob({}, manifest.revision);
    manifest.files.push({ path, module: 'extensions', schemaVersion: 1, fileVersion: manifest.revision, bytes: blob.length, sha256: blob.sha256 });
    files.set(path, blob.bytes); files.set('manifest.json', encodeCanonical(manifest));
    await expect(validateCanonicalTree(manifest, files)).rejects.toThrow('unlisted account');
  });

  it('rejects rehashed index projections ordinal gaps partitions and malformed canonical hit metadata', async () => {
    const id = await account(); await appendHit(id, hit);
    const original = await tree(), root = accountPath(id), indexPath = `${root}/run/index.json`, chunkPath = `${root}/run/y1970-m01-000001.json`;
    for (const mutate of [
      (index: RunIndex) => ({ ...index, firstAt: 1 }),
      (index: RunIndex) => ({ ...index, timestamps: [{ at: 1, count: 1, firstOrdinal: 0 }] }),
      (index: RunIndex) => ({ ...index, recent: [{ ...index.recent[0], at: 1 }] }),
      (index: RunIndex) => ({ ...index, hitIds: ['invented'] }),
    ]) {
      const manifest = structuredClone(original.manifest), files = new Map(original.files);
      await rewrite(manifest, files, indexPath, mutate(decodeCanonical(files.get(indexPath)!) as unknown as RunIndex));
      await expect(validateCanonicalTree(manifest, files)).rejects.toThrow();
    }
    for (const replacement of [{ ordinal: 1, hit }, { ordinal: 0, hit: { ...hit, at: Date.UTC(2026, 0, 1) } }, { ordinal: 0, hit: { id: 'canonical', at: 0 } }]) {
      const manifest = structuredClone(original.manifest), files = new Map(original.files);
      const chunk = decodeCanonical(files.get(chunkPath)!) as unknown as Chunk;
      await rewrite(manifest, files, chunkPath, { ...chunk, entries: [replacement] });
      const index = decodeCanonical(files.get(indexPath)!) as unknown as RunIndex;
      Object.assign(index.chunks[0], manifest.files.find(file => file.path === chunkPath));
      await rewrite(manifest, files, indexPath, index);
      await expect(validateCanonicalTree(manifest, files)).rejects.toThrow();
    }
  });

  it('permits identical incoming duplicate ids only in import mode and rejects conflicting copies', async () => {
    const id = await account(); await appendHit(id, hit);
    const { manifest, files } = await tree(), root = accountPath(id), chunkPath = `${root}/run/y1970-m01-000001.json`, indexPath = `${root}/run/index.json`;
    const chunk = decodeCanonical(files.get(chunkPath)!) as unknown as Chunk;
    chunk.entries.push({ ordinal: 1, hit: { ...hit } });
    await rewrite(manifest, files, chunkPath, chunk);
    const index = decodeCanonical(files.get(indexPath)!) as unknown as RunIndex;
    Object.assign(index.chunks[0], manifest.files.find(file => file.path === chunkPath), { count: 2, lastOrdinal: 1 });
    Object.assign(index, { total: 2, nextOrdinal: 2, hitIds: [hit.id, hit.id], timestamps: [{ at: 0, count: 2, firstOrdinal: 0 }], recent: [{ path: chunkPath, ordinal: 0, at: 0 }, { path: chunkPath, ordinal: 1, at: 0 }] });
    await rewrite(manifest, files, indexPath, index);
    await expect(validateCanonicalTree(manifest, files)).rejects.toThrow();
    await expect(validateCanonicalTree(manifest, files, { import: true })).resolves.toBeUndefined();
    chunk.entries[1].hit = { ...hit, conflicting: true };
    await rewrite(manifest, files, chunkPath, chunk);
    Object.assign(index.chunks[0], manifest.files.find(file => file.path === chunkPath));
    await rewrite(manifest, files, indexPath, index);
    await expect(validateCanonicalTree(manifest, files, { import: true })).rejects.toThrow('conflicting');
  });

  it('validates source index membership digest ownership dedup and nonrecursive logical provenance', async () => {
    const id = await account(), root = accountPath(id), original = await tree();
    const payload = { accountId: crypto.randomUUID(), files: { 'extensions.json': { opaque: [null, false], presence: null } }, shared: { 'shared/extensions.json': ['original'] } };
    const sourceDigest = await sha256(encodeCanonical(payload)), path = `${root}/imports/i-00000001.json`;
    const source = { accountId: id, schemaVersion: 1, recordVersion: original.manifest.revision, createdAt: 0, updatedAt: 0, importId: 'i-00000001', sourceDigest, payload };
    const manifest = structuredClone(original.manifest), files = new Map(original.files), bytes = encodeCanonical(source);
    manifest.files.push({ path, module: 'i-00000001', schemaVersion: 1, fileVersion: manifest.revision, bytes: bytes.length, sha256: await sha256(bytes) });
    files.set(path, bytes);
    const indexPath = `${root}/imports/index.json`, imports = decodeCanonical(files.get(indexPath)!) as unknown as Envelope<unknown[]>;
    imports.payload = [{ importId: 'i-00000001', path, sourceDigest }];
    await rewrite(manifest, files, indexPath, imports);
    await expect(validateCanonicalTree(manifest, files)).resolves.toBeUndefined();
    for (const value of [
      { ...source, sourceDigest: '0'.repeat(64) }, { ...source, importId: 'i-00000002' },
      { ...source, accountId: payload.accountId },
      { ...source, payload: { ...payload, files: { 'imports/index.json': [] } } },
    ]) {
      const alteredManifest = structuredClone(manifest), alteredFiles = new Map(files);
      await rewrite(alteredManifest, alteredFiles, path, value);
      await expect(validateCanonicalTree(alteredManifest, alteredFiles)).rejects.toThrow();
    }
    const orphanManifest = structuredClone(manifest), orphanFiles = new Map(files);
    await rewrite(orphanManifest, orphanFiles, indexPath, { ...imports, payload: [] });
    await expect(validateCanonicalTree(orphanManifest, orphanFiles)).rejects.toThrow('omits');
    await rewrite(manifest, files, indexPath, { ...imports, payload: [...imports.payload, ...imports.payload] });
    await expect(validateCanonicalTree(manifest, files)).rejects.toThrow('duplicate');
  });

  it('checks lazy file bytes again before semantics and never retains or requests unrelated history', async () => {
    const id = await account(); await appendHit(id, hit);
    const { manifest, files } = await tree(), calls = new Map<string, number>(), path = `${accountPath(id)}/account.json`;
    await expect(validateCanonicalFiles(manifest, async requested => {
      calls.set(requested, (calls.get(requested) ?? 0) + 1);
      return requested === path && calls.get(requested)! > 1 ? encodeCanonical({}) : files.get(requested)!;
    })).rejects.toThrow('changed during');
    const seen: string[] = [];
    await expect(validateCanonicalFiles(manifest, async requested => { seen.push(requested); return files.get(requested)!; })).resolves.toBeUndefined();
    expect(new Set(seen)).toEqual(new Set(files.keys()));
  });
});
