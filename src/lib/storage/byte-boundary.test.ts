import { expect, it, vi } from 'vitest';
import { decodeCanonical } from '../../../shared/codec';
import { appendChunk, emptyIndex } from './chunks';
import type { Chunk } from './state-model';

it('allows exactly one million UTF-8 envelope bytes and rolls the next byte without rewriting the completed tail', async () => {
  const clock = vi.spyOn(Date, 'now').mockReturnValue(0);
  try {
    const accountId = crypto.randomUUID();
    const initial = emptyIndex(accountId, '1');
    const hit = { id: 'first', at: 0, schemaVersion: 1, recordVersion: '1', multibyte: 'é🙂', padding: '' };
    const measured = await appendChunk(accountId, initial, hit, null, '1');
    const exactHit = { ...hit, padding: 'x'.repeat(1_000_000 - measured.blob.length) };
    const equal = await appendChunk(accountId, initial, exactHit, null, '1');
    expect(equal.blob.bytes.byteLength).toBe(1_000_000);
    const tail: Chunk = { accountId, schemaVersion: 1, recordVersion: '1', createdAt: 0, updatedAt: 0,
      partition: 'y1970-m01', sequence: 1, entries: [{ ordinal: 0, hit: exactHit }] };
    const original = Array.from(equal.blob.bytes);
    const next = await appendChunk(accountId, equal.index, { id: 'second', at: 0, schemaVersion: 1, recordVersion: '1' }, tail, '2');
    expect(next.path).toContain('-000002.json');
    expect(next.index.chunks[0]).toEqual(equal.index.chunks[0]);
    expect(Array.from(equal.blob.bytes)).toEqual(original);
    expect(decodeCanonical(next.blob.bytes)).toMatchObject({ entries: [{ ordinal: 1, hit: { id: 'second', at: 0 } }] });
    await expect(appendChunk(accountId, initial, { ...exactHit, padding: `${exactHit.padding}x` }, null, '1')).rejects.toMatchObject({ code: 'oversized-hit' });
  } finally { clock.mockRestore(); }
});
