import {
  appendHit, createAccount, initializeStorage, readRecord, updateExtensions,
  updatePlugin, updateSettings, type UserRecord,
} from '../lib/storage';

/** Seed through the same committed commands as the application; never write IDB here. */
export async function seedRecord(record: UserRecord): Promise<void> {
  await initializeStorage();
  if (await readRecord(record.username)) throw new Error(`seedRecord requires a fresh account: ${record.username}`);
  const previousNow = Object.getOwnPropertyDescriptor(Date, 'now');
  let accountId: string;
  try {
    Object.defineProperty(Date, 'now', { configurable: true, writable: true, value: () => record.registeredAt });
    const receipt = await createAccount(record.username, record.profile ?? {});
    accountId = receipt.accountId!;
  } finally {
    if (previousNow) Object.defineProperty(Date, 'now', previousNow);
  }
  for (const hit of record.hits) await appendHit(accountId, hit);
  const settings = Object.fromEntries(Object.entries(record.settings ?? {}).filter(([key]) => !['games', 'timezone', 'theme', 'darkMode'].includes(key)));
  if (Object.keys(settings).length) await updateSettings(accountId, settings);
  const games = record.settings?.games;
  if (games || record.cardCollections) {
    await updatePlugin(accountId, { ...(games ? { settings: games } : {}), ...(record.cardCollections ? { cardCollections: record.cardCollections } : {}) });
  }
  const owned = new Set(['username', 'registeredAt', 'hits', 'profile', 'settings', 'cardCollections', 'accountId']);
  const extensions = Object.fromEntries(Object.entries(record).filter(([key]) => !owned.has(key)));
  if (Object.keys(extensions).length) await updateExtensions(accountId, extensions);
}
