// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { encodeCanonical, manifestDigests, sha256 } from './codec';

describe('exact-byte WebCrypto integrity', () => {
  it('uses real runtime SubtleCrypto with published SHA-256 vectors', async () => {
    expect(globalThis.crypto.subtle).toBeDefined();
    expect(await sha256(new Uint8Array())).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(await sha256(new TextEncoder().encode('abc')))
      .toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('hashes exact selected bytes, not a parsed/reserialized approximation', async () => {
    const encoded = new TextEncoder().encode('xabcx');
    expect(await sha256(encoded.subarray(1, 4)))
      .toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    const raw = new TextEncoder().encode('{ "a" : 1 }\n');
    expect(await sha256(raw)).not.toBe(await sha256(encodeCanonical({ a: 1 })));
    const malformed = new Uint8Array([0xff, 0, 0xfe]);
    expect(await sha256(malformed)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('owns a snapshot even if the caller mutates a buffer while digesting', async () => {
    const bytes = new TextEncoder().encode('abc');
    const digest = sha256(bytes);
    bytes.fill(0);
    expect(await digest).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('manifest digest roles', () => {
  const auth = Object.freeze({ algorithm: null, keyId: null, signature: null });
  const manifest = Object.freeze({ files: [], revision: '1', auth });

  it('includes the reserved auth block in integrity and excludes it from signable', async () => {
    const digests = await manifestDigests(manifest);
    expect(digests.integrity).toBe(await sha256(encodeCanonical(manifest)));
    expect(digests.signable).toBe(await sha256(encodeCanonical({ files: [], revision: '1' })));
    expect(digests.integrity).not.toBe(digests.signable);
    expect(manifest.auth).toBe(auth);
  });

  it('omits only top-level auth and is invariant to input object insertion order', async () => {
    const first = { revision: '1', auth, nested: { auth: 'keep' } };
    const reordered = { nested: { auth: 'keep' }, auth, revision: '1' };
    expect(await manifestDigests(first)).toEqual(await manifestDigests(reordered));
    const digests = await manifestDigests(first);
    expect(digests.signable).toBe(await sha256(encodeCanonical({ nested: { auth: 'keep' }, revision: '1' })));
    const changedAuth = await manifestDigests({ ...first, auth: { algorithm: 'future', keyId: 'k', signature: 's' } });
    expect(changedAuth.integrity).not.toBe(digests.integrity);
    expect(changedAuth.signable).toBe(digests.signable);
    const changedNested = await manifestDigests({ ...first, nested: { auth: 'different' } });
    expect(changedNested.signable).not.toBe(digests.signable);
  });

  it('never hides invalid auth values by omitting them before full validation', async () => {
    await expect(manifestDigests({ auth: undefined })).rejects.toMatchObject({ code: 'UNSUPPORTED_VALUE' });
    await expect(manifestDigests([])).rejects.toMatchObject({ code: 'UNSUPPORTED_VALUE' });
    await expect(manifestDigests(null)).rejects.toMatchObject({ code: 'UNSUPPORTED_VALUE' });
  });
});
