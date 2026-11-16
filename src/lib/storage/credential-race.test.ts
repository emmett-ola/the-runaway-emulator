import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { resetStorage as resetSetupStorage } from './index';

interface Tab {
  api: typeof import('./index');
  auth: typeof import('../../auth');
  idb: typeof import('./idb');
}
const tabs: Tab[] = [];
const openTab = async (): Promise<Tab> => {
  vi.resetModules();
  const tab = { api: await import('./index'), auth: await import('../../auth'), idb: await import('./idb') };
  tabs.push(tab); await tab.api.initializeStorage(); return tab;
};
const synthetic = () => `SYNTHETIC-RACE-${crypto.randomUUID()}`;
beforeEach(async () => {
  await resetSetupStorage();
  sessionStorage.clear();
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('BroadcastChannel', undefined);
});
afterEach(async () => {
  vi.restoreAllMocks();
  for (const tab of tabs.splice(0)) await tab.api.resetStorage();
  vi.unstubAllGlobals();
});
describe('password identity across independent tab-like queues', () => {
  it.each([false, true])('one same-handle password setter wins without adopting or overwriting the winner (predecessor=%s)', async predecessor => {
    const a = await openTab();
    if (predecessor) await a.api.createAccount('cross-race');
    const b = await openTab();
    const identities = await Promise.all([a.auth.lookupLocalIdentity('cross-race'), b.auth.lookupLocalIdentity('cross-race')]);
    const passwords = [synthetic(), synthetic()];
    const results = await Promise.allSettled([a.auth.setupLocalPassword(identities[0], passwords[0], passwords[0]), b.auth.setupLocalPassword(identities[1], passwords[1], passwords[1])]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected').every(result => result.status === 'rejected' && result.reason.code === 'identity_changed')).toBe(true);
    const winner = results.findIndex(result => result.status === 'fulfilled'), loser = 1 - winner;
    const accounts = Object.values((await a.api.readStore()).users);
    expect(accounts).toHaveLength(1);
    const id = accounts[0].accountId, record = await a.api.readCredential(id);
    expect(record).not.toBeNull();
    a.auth.logout(); b.auth.logout();
    await expect(a.auth.login('cross-race', passwords[loser])).rejects.toMatchObject({ code: 'invalid_credentials' });
    expect((await b.auth.login('cross-race', passwords[winner])).accountId).toBe(id);
    expect((await a.api.readCredential(id))?.hashB64 === record?.hashB64).toBe(true);
  });
  it('rebases different-handle first boots while retaining both distinct credential records', async () => {
    const a = await openTab(), b = await openTab();
    const identities = await Promise.all([a.auth.lookupLocalIdentity('first-a'), b.auth.lookupLocalIdentity('first-b')]);
    const passwords = [synthetic(), synthetic()];
    const accounts = await Promise.all([a.auth.setupLocalPassword(identities[0], passwords[0], passwords[0]), b.auth.setupLocalPassword(identities[1], passwords[1], passwords[1])]);
    expect(accounts[0].accountId !== accounts[1].accountId).toBe(true);
    const records = await Promise.all(accounts.map(account => a.api.readCredential(account.accountId)));
    expect(records.every(Boolean)).toBe(true);
    expect(records[0]?.saltB64 !== records[1]?.saltB64).toBe(true);
    expect(Object.keys((await a.api.readStore()).users).sort()).toEqual(['first-a', 'first-b']);
  });
  it('refuses stale username-step identity after account replacement even if both passwords match', async () => {
    const a = await openTab(), password = synthetic();
    const first = await a.auth.register('replace-race', password);
    const identity = await a.auth.lookupLocalIdentity('replace-race');
    await a.api.deleteRecord(first.accountId);
    await a.auth.register('replace-race', password);
    a.auth.logout();
    await expect(a.auth.login('replace-race', password, identity)).rejects.toMatchObject({ code: 'identity_changed' });
  });
});
