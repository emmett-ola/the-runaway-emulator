import { IDBObjectStore } from 'fake-indexeddb';
import { unzipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeCanonical, encodeCanonical, sha256 } from '../../../shared/codec';
import { createExportDocument, importUserData, applyImportedData, confirmImportedData } from './transfer';
import { appendHit, getStorageState, readFullRecord, readPreferences, readStore, readRecord, type Chunk, type Manifest } from '../storage';
import { migrate } from '../storage/migrate';
import { seedRecord } from '../../test/storage-fixtures';
import { ARCHIVE_ACCOUNT_ID, ARCHIVE_PEER_ID, archiveFile, canonicalHit, createArchiveFixture, packArchiveFiles } from '../../test/archive-fixtures';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());
const current = () => ({ username: 'current', registeredAt: 100, hits: [canonicalHit('old', 200)], profile: { email: 'keep' }, settings: { games: { cardDropEnabled: true } }, cardCollections: { '#001': 7 }, unknown: { custom: 'keep' } });
const file = (value: unknown) => new File([JSON.stringify(value)], 'restore.json');
const source = (hits = [canonicalHit('new', 300)]) => ({ username: 'other', registeredAt: 1, hits });
const targetId = async () => (await readRecord('current'))!.accountId;
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
    // Pure conversion remains testable; explicitly version the test data before seeding.
    const converted = migrate(legacy, 1).users.current;
    await seedRecord({ ...converted, hits: converted.hits.map(hit => canonicalHit(hit.id, hit.at, hit)) });
    const original = await readFullRecord('current');
    await seedRecord({ username: 'peer', registeredAt: 1, hits: [] });
    const document = await createExportDocument(original);
    const archive = await unpack(document);
    const accountId = await targetId();
    const peerId = (await readRecord('peer'))!.accountId;
    expect(archive.manifest).toMatchObject({ format: 'runawaylog-files', formatVersion: 1, schemaVersion: 2, accountId, kind: 'user' });
    expect(decodeCanonical(archive.files['shared/accounts.json'])).toMatchObject({ accounts: [{ accountId, handle: 'current', registeredAt: original.registeredAt }] });
    expect(Object.keys(archive.files).some(path => path.startsWith(`accounts/${peerId}/`))).toBe(false);
    expect(archive.hits).toEqual(original.hits);
    expect(decodeCanonical(archive.files['device/preferences.json'])).toMatchObject({ language: expect.any(String), calendarTheme: expect.any(String), timezone: expect.any(String) });
    expect(Object.values(archive.files).map(bytes => new TextDecoder().decode(bytes)).join('\n')).not.toContain(legacyBytes);
    expect(localStorage.getItem('runawaylog-data')).toBe(legacyBytes);
    const incoming = await importUserData(archiveFile(document));
    expect(incoming.hits).toEqual(original.hits);
    const merged = applyImportedData(original, incoming, 'merge');
    expect(merged.hits).toEqual(original.hits);
    expect(merged.cardCollections).toEqual(original.cardCollections);
    await confirmImportedData(accountId, incoming, 'merge');
    const again = await importUserData(archiveFile(await createExportDocument('current')));
    expect(again.hits).toEqual(original.hits);
    expect((await readStore()).users.peer.username).toBe('peer');
  });
  it('exports the latest typed record rather than a stale UI snapshot, including identity recovery bytes', async () => {
    await seedRecord(current());
    const old = current();
    await appendHit(await targetId(), canonicalHit('latest', 400));
    const legacyBytes = '["original mirror bytes"]';
    localStorage.setItem('runawaylog-current-user-backups', legacyBytes);
    const archive = await unpack(await createExportDocument(old));
    expect(archive.hits.map(hit => hit.id)).toEqual(['old', 'latest']);
    expect(Object.values(archive.files).map(bytes => new TextDecoder().decode(bytes)).join('\n')).not.toContain('original mirror bytes');
    expect(localStorage.getItem('runawaylog-current-user-backups')).toBe(legacyBytes);
  });
  it.each(['merge', 'replace'] as const)('%s retains current identity/profile/games/cards and preserves imported unknown data', async mode => {
    await seedRecord(current());
    const accountId = await targetId();
    localStorage.setItem('runawaylog-timezone', 'UTC');
    const fixture = await createArchiveFixture([{ ...source(), profile: { email: 'foreign' }, settings: { games: { forkInTheRoadEnabled: true } }, cardCollections: { '#007': 9 }, extra: { keep: true } }], {
      sharedExtensions: { backup: 'unreadable rescued bytes' }, metadata: { language: 'zh_cn', timezone: 'Asia/Tokyo', theme: 'foreign' },
    });
    const before = await readFullRecord('current');
    const preferences = await readPreferences();
    const revision = getStorageState().revision;
    const incoming = await importUserData(fixture.file);
    expect(await readFullRecord('current')).toEqual(before);
    expect(getStorageState().revision).toBe(revision);
    const result = applyImportedData(current(), incoming, mode);
    expect(result).toMatchObject({ username: 'current', registeredAt: 100, profile: current().profile, settings: current().settings, cardCollections: current().cardCollections });
    expect(result.hits.map(hit => hit.id)).toEqual(mode === 'merge' ? ['old', 'new'] : ['new']);
    expect(JSON.stringify(result.importBackups)).toContain('unreadable rescued bytes');
    expect(JSON.stringify(result.importBackups)).toContain('foreign');
    expect(JSON.stringify(result.importBackups)).toContain('#007');
    const confirmed = await confirmImportedData(accountId, incoming, mode);
    expect(confirmed).toMatchObject({ ...result, accountId });
    expect(await readPreferences()).toEqual(preferences);
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
    const incoming = await importUserData((await createArchiveFixture([source([])])).file);
    const result = await confirmImportedData(await targetId(), incoming, 'merge');
    expect(result.unknown).toEqual(existing.unknown);
    expect((await readFullRecord('current')).unknown).toEqual(existing.unknown);
  });
  it('confirmed merge reads current storage rather than losing hits added after the dialog opened', async () => {
    await seedRecord(current());
    const accountId = await targetId();
    const incoming = await importUserData((await createArchiveFixture([source([canonicalHit('import', 500)])])).file);
    await appendHit(accountId, canonicalHit('concurrent', 400));
    const result = await confirmImportedData(accountId, incoming, 'merge');
    expect(result.hits.map(hit => hit.id)).toEqual(['old', 'concurrent', 'import']);
    expect((await readFullRecord('current')).hits).toEqual(result.hits);
  });
  it('confirmed import propagates a storage failure without changing current bytes', async () => {
    await seedRecord(current());
    const accountId = await targetId();
    const before = await readFullRecord('current');
    const revision = getStorageState().revision;
    const incoming = await importUserData((await createArchiveFixture([source([])])).file);
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => { throw new DOMException('quota', 'QuotaExceededError'); });
    await expect(Promise.resolve().then(() => confirmImportedData(accountId, incoming, 'replace'))).rejects.toThrow('quota');
    vi.restoreAllMocks();
    expect(await readFullRecord('current')).toEqual(before);
    expect(getStorageState().revision).toBe(revision);
  });
  it('accepts FORMAT-1 account archives and refuses ambiguous multi-account replacement without source UUID', async () => {
    const account = { username: 'a', registeredAt: 1, hits: [canonicalHit('a-hit', 42)] };
    const single = await createArchiveFixture([account]);
    expect((await importUserData(single.file)).hits).toEqual(account.hits);
    const multiple = await createArchiveFixture([account, { username: 'b', registeredAt: 1, hits: [] }]);
    await expect(importUserData(multiple.file)).rejects.toThrow();
    expect((await importUserData(multiple.file, ARCHIVE_ACCOUNT_ID)).username).toBe('a');
    expect((await importUserData(multiple.file, ARCHIVE_PEER_ID)).username).toBe('b');
    await expect(importUserData(multiple.file, 'a')).rejects.toThrow();
    await expect(importUserData(multiple.file, '33333333-3333-4333-8333-333333333333')).rejects.toThrow();
  });

  it('rejects otherwise valid legacy JSON rather than migrating it through the ZIP importer', async () => {
    await seedRecord(current());
    const before = await readFullRecord('current');
    const revision = getStorageState().revision;
    await expect(importUserData(file(source()))).rejects.toThrow();
    expect(await readFullRecord('current')).toEqual(before);
    expect(getStorageState().revision).toBe(revision);
  });
  it('merges current-wins ids and first-new duplicates in stable ascending timestamp order', async () => {
    await seedRecord(current());
    const firstNew = canonicalHit('new', 200, { extra: ['first', null] });
    const incomingHits = [canonicalHit('late', 500), canonicalHit('old', 1, { foreign: true }), firstNew, firstNew, canonicalHit('tie', 200)];
    const incoming = await importUserData((await createArchiveFixture([source(incomingHits)])).file);
    const pure = applyImportedData(current(), incoming, 'merge');
    const expected = [current().hits[0], firstNew, incomingHits[4], incomingHits[0]];
    expect(pure.hits).toEqual(expected);
    const result = await confirmImportedData(await targetId(), incoming, 'merge');
    expect(result.hits).toEqual(expected);
    expect((await readFullRecord('current')).hits).toEqual(expected);
  });
  it('rejects conflicting duplicate incoming ids without selecting one or writing any target data', async () => {
    await seedRecord(current());
    const before = await readFullRecord('current');
    const revision = getStorageState().revision;
    const fixture = await createArchiveFixture([source([canonicalHit('conflict', 300), canonicalHit('conflict', 301)])]);
    await expect(importUserData(fixture.file)).rejects.toThrow();
    expect(await readFullRecord('current')).toEqual(before);
    expect(getStorageState().revision).toBe(revision);
  });
  it('deduplicates logical provenance across ZIP export times and repeated export/import without recursive wrappers', async () => {
    await seedRecord(current());
    const accountId = await targetId();
    const fixture = await createArchiveFixture([{ ...source(), extra: [null, 'preserve'] }], { exportedAt: 1 });
    const changedHeader = await createArchiveFixture([{ ...source(), extra: [null, 'preserve'] }], { exportedAt: 2 });
    expect(changedHeader.bytes).not.toEqual(fixture.bytes);
    const first = await confirmImportedData(accountId, await importUserData(fixture.file), 'merge');
    const repeated = await confirmImportedData(accountId, await importUserData(changedHeader.file), 'merge');
    expect(repeated.hits).toEqual(first.hits);
    expect(repeated.importBackups).toEqual(first.importBackups);
    expect(repeated.importBackups).toHaveLength(1);
    const exported = await importUserData(archiveFile(await createExportDocument('current')));
    await confirmImportedData(accountId, exported, 'merge');
    const once = await readFullRecord('current');
    const exportedAgain = await importUserData(archiveFile(await createExportDocument('current')));
    const twice = await confirmImportedData(accountId, exportedAgain, 'merge');
    expect(twice.importBackups).toEqual(once.importBackups);
    expect(twice.hits).toEqual(first.hits);
  });
  it('preserves canonical unknown scalar, null, array and presence values in immutable source provenance', async () => {
    await seedRecord(current());
    const fixture = await createArchiveFixture([{ ...source(), unknown: null, extra: ['opaque', { value: false }] }], {
      sharedExtensions: [null, 'installation-opaque'],
      mutate(files) {
        const path = `accounts/${ARCHIVE_ACCOUNT_ID}/profile.json`;
        const profile = decodeCanonical(files.get(path)!) as Record<string, unknown>;
        files.set(path, encodeCanonical({ ...profile, extensions: null, presence: ['envelope-presence'], payload: {
          fields: { nested: [null, 0, false, '保留'] }, emailVerification: 'unverified', extensions: 'scalar-extension', presence: { email: false },
        } }));
      },
    });
    const result = await confirmImportedData(await targetId(), await importUserData(fixture.file), 'merge');
    const provenance = JSON.stringify(result.importBackups);
    for (const text of ['installation-opaque', 'envelope-presence', 'scalar-extension', '保留', '"email":false', '"unknown":null', '"value":false']) expect(provenance).toContain(text);
    expect(result.unknown).toEqual(current().unknown);
    const roundtrip = await importUserData(archiveFile(await createExportDocument('current')));
    const serialized = JSON.stringify(roundtrip.importBackups);
    for (const text of ['installation-opaque', 'envelope-presence', 'scalar-extension', '保留', '"unknown":null']) expect(serialized).toContain(text);
  });
  it('validates semantic corruption in nonselected accounts before returning a source preview', async () => {
    await seedRecord(current());
    const before = await readFullRecord('current');
    const revision = getStorageState().revision;
    const fixture = await createArchiveFixture([source(), { username: 'peer', registeredAt: 1, hits: [canonicalHit('peer-hit', 500)] }]);
    const path = `accounts/${ARCHIVE_PEER_ID}/account.json`;
    const identity = decodeCanonical(fixture.files.get(path)!) as Record<string, unknown>;
    fixture.files.set(path, encodeCanonical({ ...identity, accountId: ARCHIVE_ACCOUNT_ID }));
    const corrupted = await packArchiveFiles(fixture.files, fixture.manifest);
    await expect(importUserData(archiveFile(corrupted), ARCHIVE_ACCOUNT_ID)).rejects.toThrow();
    expect(await readFullRecord('current')).toEqual(before);
    expect(getStorageState().revision).toBe(revision);
  });
  it('requires the original validated preview and confirms frozen intent despite preview mutation', async () => {
    await seedRecord(current());
    const accountId = await targetId(), before = await readFullRecord('current');
    const incoming = await importUserData((await createArchiveFixture([source()])).file);
    await expect(confirmImportedData(accountId, { ...incoming }, 'merge')).rejects.toThrow('Validate the original ZIP');
    expect(await readFullRecord('current')).toEqual(before);
    incoming.hits[0].id = 'tampered';
    incoming.importSources![0].files['extensions.json'] = { tampered: true };
    const result = await confirmImportedData(accountId, incoming, 'merge');
    expect(result.hits.map(hit => hit.id)).toEqual(['old', 'new']);
    expect(JSON.stringify(result.importBackups)).not.toContain('tampered');
  });
  it('round-trips depth-64 original files through confirmation and export without wrapping away their depth budget', async () => {
    await seedRecord(current());
    let nested: unknown = null;
    for (let depth = 0; depth < 61; depth++) nested = { child: nested };
    const fixture = await createArchiveFixture([source()], {
      mutate(files) {
        const path = `accounts/${ARCHIVE_ACCOUNT_ID}/extensions.json`;
        const original = decodeCanonical(files.get(path)!) as Record<string, unknown>;
        files.set(path, encodeCanonical({ ...original, payload: { nested } }));
      },
    });
    const preview = await importUserData(fixture.file), accountId = await targetId();
    const result = await confirmImportedData(accountId, preview, 'merge');
    expect(result.importBackups).toEqual(preview.importBackups);
    const reimported = await importUserData(archiveFile(await createExportDocument('current')));
    expect(reimported.importBackups?.[0]).toEqual(preview.importBackups?.[0]);
    const again = await confirmImportedData(accountId, reimported, 'merge');
    expect(again.hits.map(hit => hit.id)).toEqual(['old', 'new']);
    expect(again.importBackups?.[0]).toEqual(preview.importBackups?.[0]);
  });
  it('requires an existing explicit target UUID and never adopts the incoming account identity', async () => {
    await seedRecord(current());
    const before = await readFullRecord('current');
    const revision = getStorageState().revision;
    const incoming = await importUserData((await createArchiveFixture([source()])).file);
    await expect(Promise.resolve().then(() => confirmImportedData('current', incoming, 'merge'))).rejects.toThrow();
    await expect(Promise.resolve().then(() => confirmImportedData('33333333-3333-4333-8333-333333333333', incoming, 'merge'))).rejects.toThrow();
    expect(await readFullRecord('current')).toEqual(before);
    expect(getStorageState().revision).toBe(revision);
    const result = await confirmImportedData(await targetId(), incoming, 'replace');
    expect(result).toMatchObject({ accountId: await targetId(), username: 'current', registeredAt: 100 });
    expect(await readRecord('other')).toBeNull();
  });
});
