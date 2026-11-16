import { IDBObjectStore } from 'fake-indexeddb';
import { unzipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeCanonical, sha256 } from '../../../shared/codec';
import { createExportDocument, importUserData, applyImportedData, confirmImportedData } from './transfer';
import { appendHit, getStorageState, readFullRecord, readStore, readRecord, type Chunk, type Manifest } from '../storage';
import { migrate } from '../storage/migrate';
import { seedRecord } from '../../test/storage-fixtures';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());
const current = () => ({ username: 'current', registeredAt: 100, hits: [{ id: 'old', at: 200 }], profile: { email: 'keep' }, settings: { games: { cardDropEnabled: true } }, cardCollections: { '#001': 7 }, unknown: { custom: 'keep' } });
const file = (value: unknown) => new File([JSON.stringify(value)], 'restore.json');
const zipFile = (bytes: Uint8Array) => new File([new Uint8Array(bytes)], 'restore.zip', { type: 'application/zip' });
const unpack = async (bytes: Uint8Array) => {
  const files = unzipSync(bytes);
  const manifest = decodeCanonical(files['manifest.json']) as unknown as Manifest;
  for (const descriptor of manifest.files) {
    expect(files[descriptor.path].byteLength).toBe(descriptor.bytes);
    expect(await sha256(files[descriptor.path])).toBe(descriptor.sha256);
  }
  const entries = manifest.files.filter(descriptor => descriptor.path.includes('/run/') && !descriptor.path.endsWith('/index.json')).flatMap(descriptor =>
    (decodeCanonical(files[descriptor.path]) as unknown as Chunk).entries);
  return { files, manifest, hits: entries.sort((a, b) => a.ordinal - b.ordinal).map(entry => entry.hit) };
};

describe('v2 transfer', () => {
  it('exports a single v2 user, metadata, and global unknown rescue; migrates a legacy roundtrip with zero loss/duplication', async () => {
    const legacy = { username: 'current', hits: [{ timestamp: 42 }, { id: 'b', date: '2024-01-01' }], profile: { email: 'keep' }, settings: { games: { cardDropEnabled: true } }, cardCollections: { '#001': 7 }, extra: [1] };
    const legacyBytes = JSON.stringify(legacy);
    localStorage.setItem('runawaylog-data', legacyBytes);
    expect(await readRecord('current')).toBeNull();
    // Pure conversion remains testable, but browser bootstrap never imports old bytes.
    await seedRecord(migrate(legacy, 1).users.current);
    const source = await readFullRecord('current');
    await seedRecord({ username: 'peer', registeredAt: 1, hits: [] });
    const document = await createExportDocument(source);
    const archive = await unpack(document);
    const accountId = (await readRecord('current'))!.accountId;
    const peerId = (await readRecord('peer'))!.accountId;
    expect(archive.manifest).toMatchObject({ format: 'runawaylog-files', formatVersion: 1, schemaVersion: 2, accountId, kind: 'user' });
    expect(decodeCanonical(archive.files['shared/accounts.json'])).toMatchObject({ accounts: [{ accountId, handle: 'current', registeredAt: source.registeredAt }] });
    expect(Object.keys(archive.files).some(path => path.startsWith(`accounts/${peerId}/`))).toBe(false);
    expect(archive.hits).toEqual(source.hits);
    expect(decodeCanonical(archive.files['device/preferences.json'])).toMatchObject({ language: expect.any(String), calendarTheme: expect.any(String), timezone: expect.any(String) });
    expect(Object.values(archive.files).map(bytes => new TextDecoder().decode(bytes)).join('\n')).not.toContain(legacyBytes);
    expect(localStorage.getItem('runawaylog-data')).toBe(legacyBytes);
    const incoming = await importUserData(zipFile(document));
    expect(incoming.hits).toEqual(source.hits);
    const merged = applyImportedData(source, incoming, 'merge');
    expect(merged.hits).toEqual(source.hits);
    expect(merged.cardCollections).toEqual(source.cardCollections);
    await confirmImportedData('current', incoming, 'merge');
    const again = await importUserData(zipFile(await createExportDocument('current')));
    expect(again.hits).toEqual(source.hits);
    expect((await readStore()).users.peer.username).toBe('peer');
  });
  it('exports the latest typed record rather than a stale UI snapshot, including identity recovery bytes', async () => {
    await seedRecord(current());
    const old = current();
    await appendHit((await readRecord('current'))!.accountId, { id: 'latest', at: 400 });
    const legacyBytes = '["original mirror bytes"]';
    localStorage.setItem('runawaylog-current-user-backups', legacyBytes);
    const archive = await unpack(await createExportDocument(old));
    expect(archive.hits.map(hit => hit.id)).toEqual(['old', 'latest']);
    expect(Object.values(archive.files).map(bytes => new TextDecoder().decode(bytes)).join('\n')).not.toContain('original mirror bytes');
    expect(localStorage.getItem('runawaylog-current-user-backups')).toBe(legacyBytes);
  });
  it.each(['merge', 'replace'] as const)('%s retains current identity/profile/games/cards and preserves imported unknown data', async mode => {
    await seedRecord(current());
    localStorage.setItem('runawaylog-timezone', 'UTC');
    const raw = { schemaVersion: 2, users: { other: { username: 'other', registeredAt: 1, hits: [{ id: 'new', at: 300 }], profile: { email: 'foreign' }, settings: { games: { forkInTheRoadEnabled: true } }, cardCollections: { '#007': 9 }, extra: { keep: true } } }, unknown: { backup: 'unreadable rescued bytes' }, metadata: { language: 'zh_cn', timezone: 'Asia/Tokyo', theme: 'foreign' } };
    const before = await readFullRecord('current');
    const revision = getStorageState().revision;
    const incoming = await importUserData(file(raw));
    expect(await readFullRecord('current')).toEqual(before);
    expect(getStorageState().revision).toBe(revision);
    const result = applyImportedData(current(), incoming, mode);
    expect(result).toMatchObject({ username: 'current', registeredAt: 100, profile: current().profile, settings: current().settings, cardCollections: current().cardCollections });
    expect(result.hits.map(hit => hit.id)).toEqual(mode === 'merge' ? ['old', 'new'] : ['new']);
    expect(JSON.stringify(result.importBackups)).toContain('unreadable rescued bytes');
    expect(JSON.stringify(result.importBackups)).toContain('foreign');
    expect(JSON.stringify(result.importBackups)).toContain('#007');
    await confirmImportedData('current', incoming, mode);
    const exported = await unpack(await createExportDocument(result));
    expect(Object.values(exported.files).map(bytes => new TextDecoder().decode(bytes)).join('\n')).toContain('unreadable rescued bytes');
    expect(localStorage.getItem('runawaylog-timezone')).toBe('UTC');
    expect(localStorage.getItem('app-language')).toBeNull();
    expect(localStorage.getItem('calendar-theme')).toBeNull();
  });
  it.each([null, [], { username: 'x', hits: [null] }, { schemaVersion: 2, users: {} }, { username: 'x', hits: [{ date: '2024-02-30' }] }])('rejects unsafe imports without touching existing bytes: %j', async raw => {
    await seedRecord(current());
    const before = await readFullRecord('current');
    const revision = getStorageState().revision;
    await expect(importUserData(file(raw))).rejects.toThrow();
    expect(await readFullRecord('current')).toEqual(before);
    expect(getStorageState().revision).toBe(revision);
  });
  it('preserves arbitrary existing unknown values across a confirmed import', async () => {
    const existing = { ...current(), unknown: ['opaque', { keep: true }] };
    await seedRecord(existing);
    const incoming = await importUserData(file({ username: 'other', hits: [] }));
    const result = await confirmImportedData('current', incoming, 'merge');
    expect(result.unknown).toEqual(existing.unknown);
    expect((await readFullRecord('current')).unknown).toEqual(existing.unknown);
  });
  it('confirmed merge reads current storage rather than losing hits added after the dialog opened', async () => {
    await seedRecord(current());
    const incoming = await importUserData(file({ username: 'other', hits: [{ id: 'import', at: 500 }] }));
    await appendHit((await readRecord('current'))!.accountId, { id: 'concurrent', at: 400 });
    const result = await confirmImportedData('current', incoming, 'merge');
    expect(result.hits.map(hit => hit.id)).toEqual(['old', 'concurrent', 'import']);
    expect((await readFullRecord('current')).hits).toEqual(result.hits);
  });
  it('confirmed import propagates a storage failure without changing current bytes', async () => {
    await seedRecord(current());
    const before = await readFullRecord('current');
    const revision = getStorageState().revision;
    const incoming = await importUserData(file({ username: 'other', hits: [] }));
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => { throw new DOMException('quota', 'QuotaExceededError'); });
    await expect(Promise.resolve().then(() => confirmImportedData('current', incoming, 'replace'))).rejects.toThrow('quota');
    vi.restoreAllMocks();
    expect(await readFullRecord('current')).toEqual(before);
    expect(getStorageState().revision).toBe(revision);
  });
  it('accepts legacy maps through the same migration and refuses ambiguous multi-user replacement', async () => {
    const legacy = { a: { username: 'a', hits: [{ timestamp: 42 }] } };
    expect((await importUserData(file(legacy))).hits).toEqual(migrate(legacy, 1).users.a.hits);
    await expect(importUserData(file({ ...legacy, b: { username: 'b', hits: [] } }))).rejects.toThrow();
    expect((await importUserData(file({ ...legacy, b: { username: 'b', hits: [] } }), 'a')).username).toBe('a');
  });
});
