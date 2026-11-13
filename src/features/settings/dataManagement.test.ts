import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createExportDocument, importUserData, applyImportedData, confirmImportedData } from './dataManagement';
import { readStore, readRecord, writeRecord } from '../../lib/storage';
import { migrate } from '../../lib/storage/migrate';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());
const current = () => ({ username: 'current', registeredAt: 100, hits: [{ id: 'old', at: 200 }], profile: { email: 'keep' }, settings: { games: { cardDropEnabled: true } }, cardCollections: { '#001': 7 }, unknown: { custom: 'keep' } });
const file = (value: unknown) => new File([JSON.stringify(value)], 'restore.json');

describe('v2 transfer', () => {
  it('exports a single v2 user, metadata, and global unknown rescue; migrates a legacy roundtrip with zero loss/duplication', async () => {
    const legacy = { username: 'current', hits: [{ timestamp: 42 }, { id: 'b', date: '2024-01-01' }], profile: { email: 'keep' }, settings: { games: { cardDropEnabled: true } }, cardCollections: { '#001': 7 }, extra: [1] };
    localStorage.setItem('runawaylog-data', JSON.stringify(legacy));
    const source = readRecord('current')!;
    writeRecord({ username: 'peer', registeredAt: 1, hits: [] });
    const document = createExportDocument(source);
    expect(document.schemaVersion).toBe(2);
    expect(Object.keys(document.users)).toEqual(['current']);
    expect(document.users.current).toEqual(source);
    expect(document.unknown?.backup).toBe(JSON.stringify(legacy));
    expect(document.metadata).toMatchObject({ language: expect.any(String), theme: expect.any(String), timezone: expect.any(String) });
    const incoming = await importUserData(file(document));
    expect(incoming.hits).toEqual(source.hits);
    const merged = applyImportedData(source, incoming, 'merge');
    expect(merged.hits).toEqual(source.hits);
    expect(merged.cardCollections).toEqual(source.cardCollections);
    writeRecord(merged);
    const again = await importUserData(file(createExportDocument(readRecord('current')!)));
    expect(again.hits).toEqual(source.hits);
    expect(JSON.stringify(again)).toContain(JSON.stringify(legacy).replaceAll('"', '\\"'));
    expect(readStore().users.peer.username).toBe('peer');
  });
  it('exports the latest typed record rather than a stale UI snapshot, including identity recovery bytes', () => {
    writeRecord(current());
    const old = current();
    writeRecord({ ...current(), hits: [...current().hits, { id: 'latest', at: 400 }] });
    localStorage.setItem('runawaylog-current-user-backups', '["original mirror bytes"]');
    const document = createExportDocument(old);
    expect(document.users.current.hits.map(hit => hit.id)).toEqual(['old', 'latest']);
    expect(JSON.stringify(document.unknown)).toContain('original mirror bytes');
  });
  it.each(['merge', 'replace'] as const)('%s retains current identity/profile/games/cards and preserves imported unknown data', async mode => {
    writeRecord(current());
    localStorage.setItem('runawaylog-timezone', 'UTC');
    const raw = { schemaVersion: 2, users: { other: { username: 'other', registeredAt: 1, hits: [{ id: 'new', at: 300 }], profile: { email: 'foreign' }, settings: { games: { forkInTheRoadEnabled: true } }, cardCollections: { '#007': 9 }, extra: { keep: true } } }, unknown: { backup: 'unreadable rescued bytes' }, metadata: { language: 'zh_cn', timezone: 'Asia/Tokyo', theme: 'foreign' } };
    const before = localStorage.getItem('runawaylog-data');
    const incoming = await importUserData(file(raw));
    expect(localStorage.getItem('runawaylog-data')).toBe(before);
    const result = applyImportedData(current(), incoming, mode);
    expect(result).toMatchObject({ username: 'current', registeredAt: 100, profile: current().profile, settings: current().settings, cardCollections: current().cardCollections });
    expect(result.hits.map(hit => hit.id)).toEqual(mode === 'merge' ? ['old', 'new'] : ['new']);
    expect(JSON.stringify(result.importBackups)).toContain('unreadable rescued bytes');
    expect(JSON.stringify(result.importBackups)).toContain('foreign');
    expect(JSON.stringify(result.importBackups)).toContain('#007');
    writeRecord(result);
    expect(JSON.stringify(createExportDocument(result))).toContain('unreadable rescued bytes');
    expect(localStorage.getItem('runawaylog-timezone')).toBe('UTC');
    expect(localStorage.getItem('app-language')).toBeNull();
    expect(localStorage.getItem('calendar-theme')).toBeNull();
  });
  it.each([null, [], { username: 'x', hits: [null] }, { schemaVersion: 2, users: {} }, { username: 'x', hits: [{ date: '2024-02-30' }] }])('rejects unsafe imports without touching existing bytes: %j', async raw => {
    writeRecord(current());
    const before = localStorage.getItem('runawaylog-data');
    await expect(importUserData(file(raw))).rejects.toThrow();
    expect(localStorage.getItem('runawaylog-data')).toBe(before);
  });
  it('preserves arbitrary existing unknown values across a confirmed import', async () => {
    const existing = { ...current(), unknown: ['opaque', { keep: true }] };
    writeRecord(existing);
    const incoming = await importUserData(file({ username: 'other', hits: [] }));
    const result = confirmImportedData('current', incoming, 'merge');
    expect(result.unknown).toEqual(existing.unknown);
    expect(readRecord('current')!.unknown).toEqual(existing.unknown);
  });
  it('confirmed merge reads current storage rather than losing hits added after the dialog opened', async () => {
    writeRecord(current());
    const incoming = await importUserData(file({ username: 'other', hits: [{ id: 'import', at: 500 }] }));
    writeRecord({ ...current(), hits: [...current().hits, { id: 'concurrent', at: 400 }] });
    const result = confirmImportedData('current', incoming, 'merge');
    expect(result.hits.map(hit => hit.id)).toEqual(['old', 'concurrent', 'import']);
    expect(readRecord('current')!.hits).toEqual(result.hits);
  });
  it('confirmed import propagates a storage failure without changing current bytes', async () => {
    writeRecord(current());
    const before = localStorage.getItem('runawaylog-data');
    const incoming = await importUserData(file({ username: 'other', hits: [] }));
    const real = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === 'runawaylog-data') throw new Error('quota');
      real.call(this, key, value);
    });
    expect(() => confirmImportedData('current', incoming, 'replace')).toThrow('quota');
    expect(localStorage.getItem('runawaylog-data')).toBe(before);
  });
  it('accepts legacy maps through the same migration and refuses ambiguous multi-user replacement', async () => {
    const legacy = { a: { username: 'a', hits: [{ timestamp: 42 }] } };
    expect((await importUserData(file(legacy))).hits).toEqual(migrate(legacy, 1).users.a.hits);
    await expect(importUserData(file({ ...legacy, b: { username: 'b', hits: [] } }))).rejects.toThrow();
    expect((await importUserData(file({ ...legacy, b: { username: 'b', hits: [] } }), 'a')).username).toBe('a');
  });
});
