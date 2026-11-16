import { expect, it, vi } from 'vitest';
import { appendHit, createAccount, getAccountSnapshot, readFullRecord } from './index';
import { withPinnedGeneration } from './commit';
import { getGeneration, pinGeneration, readBlob, readCurrent } from './idb';
import { garbageCollect } from './recovery';

it('blocks a verified write without SubtleCrypto and preserves current for a safe retry', async () => {
  const id = (await createAccount('crypto-failure')).accountId!;
  const before = await readCurrent();
  const crypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto')!;
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { randomUUID: globalThis.crypto.randomUUID.bind(globalThis.crypto) } });
  try {
    await expect(appendHit(id, { id: 'unverified', at: 0, schemaVersion: 1, recordVersion: '1' })).rejects.toThrow();
    expect(await readCurrent()).toEqual(before);
    expect(getAccountSnapshot(id)?.total).toBe(0);
  } finally { Object.defineProperty(globalThis, 'crypto', crypto); }
  await appendHit(id, { id: 'verified', at: 1, schemaVersion: 1, recordVersion: '1' });
  expect((await readFullRecord(id)).hits.map(hit => hit.id)).toEqual(['verified']);
});

it('restarts an expired pinned read after GC and reports missing generations as restartable', async () => {
  const id = (await createAccount('lease-failure')).accountId!;
  const original = (await readCurrent())!.generation;
  const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now());
  let attempts = 0;
  try {
    const result = await withPinnedGeneration(async generation => {
      attempts++;
      if (attempts === 1) {
        clock.mockReturnValue(Date.now() + 121_000);
        for (let index = 0; index < 4; index++) await appendHit(id, { id: `competing-${index}`, at: index, schemaVersion: 1, recordVersion: '1' });
        await garbageCollect();
      }
      await readBlob(generation.map['manifest.json']);
      return generation.id;
    });
    expect(attempts).toBe(2);
    expect(result).toBe((await readCurrent())?.generation);
    await expect(getGeneration(original)).rejects.toMatchObject({ code: 'missing-generation' });
    await expect(pinGeneration(original)).rejects.toMatchObject({ code: 'expired-reader' });
  } finally { clock.mockRestore(); }
});
