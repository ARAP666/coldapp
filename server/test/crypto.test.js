// Tests for the symmetric encryption helper.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encrypt, decrypt, packEnvelope, unpackEnvelope } from '../src/crypto.js';

describe('encryption', () => {
  let originalKey;

  beforeEach(() => {
    originalKey = process.env.FRIA_ENCRYPTION_KEY;
    // A valid base64-encoded 32-byte key.
    process.env.FRIA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    // Bust the cached key inside crypto.js by deleting the require cache.
    delete require.cache[require.resolve('../src/crypto.js')];
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.FRIA_ENCRYPTION_KEY;
    else process.env.FRIA_ENCRYPTION_KEY = originalKey;
    delete require.cache[require.resolve('../src/crypto.js')];
  });

  it('round-trips a string through encrypt/decrypt', () => {
    const env = encrypt('hola mundo');
    expect(env.ct).toBeDefined();
    expect(env.iv).toBeDefined();
    expect(env.tag).toBeDefined();
    expect(decrypt(env)).toBe('hola mundo');
  });

  it('produces different ciphertexts for the same input (random IV)', () => {
    const a = encrypt('hola');
    const b = encrypt('hola');
    expect(a.ct.equals(b.ct)).toBe(false);
    expect(a.iv.equals(b.iv)).toBe(false);
    expect(decrypt(a)).toBe('hola');
    expect(decrypt(b)).toBe('hola');
  });

  it('returns null for null/undefined input', () => {
    expect(encrypt(null).ct).toBeNull();
    expect(encrypt(undefined).ct).toBeNull();
  });

  it('fails decryption when the tag is tampered with', () => {
    const env = encrypt('hola');
    env.tag[0] ^= 0xff;
    expect(() => decrypt(env)).toThrow();
  });

  it('packEnvelope / unpackEnvelope round-trip preserves ciphertext', () => {
    const env = encrypt('hola mundo');
    const blob = packEnvelope(env);
    expect(blob[0]).toBe(1); // version byte
    const env2 = unpackEnvelope(blob);
    expect(decrypt(env2)).toBe('hola mundo');
  });

  it('falls back to plaintext passthrough when no key is set', async () => {
    delete process.env.FRIA_ENCRYPTION_KEY;
    delete require.cache[require.resolve('../src/crypto.js')];
    const plain = require('../src/crypto.js');
    const env = plain.encrypt('hola');
    expect(env.ct.toString('utf8')).toBe('plain:hola');
    expect(plain.decrypt(env)).toBe('hola');
  });
});
