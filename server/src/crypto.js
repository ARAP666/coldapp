// Symmetric encryption helpers for sensitive columns.
// Uses AES-256-GCM via Node's crypto module. Key comes from the
// FRIA_ENCRYPTION_KEY env var (a base64-encoded 32-byte key). When the key
// is absent, encrypt() returns the plaintext prefixed with `plain:` so
// readers can still detect it and so dev/test runs work without secrets.
//
// This is **not** end-to-end. The server holds the key, so it can read
// plaintext on the way in and out. The goal is to make a DB dump
// unreadable without the key, and to make sure no chat content lives in
// plaintext on disk.

const crypto = require('crypto');
const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

let cachedKey = null;

function getKey() {
  if (cachedKey !== null) return cachedKey;
  const raw = process.env.FRIA_ENCRYPTION_KEY || '';
  if (!raw) {
    cachedKey = Buffer.alloc(0);
    return cachedKey;
  }
  try {
    const buf = Buffer.from(raw, 'base64');
    if (buf.length !== 32) {
      cachedKey = Buffer.alloc(0);
      return cachedKey;
    }
    cachedKey = buf;
    return cachedKey;
  } catch {
    cachedKey = Buffer.alloc(0);
    return cachedKey;
  }
}

// Returns { ct, iv, tag } all as Buffers when a key is set, or
// { ct: <plaintext> } when no key is configured (dev/test mode).
function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined) return { ct: null };
  const key = getKey();
  if (key.length === 0) {
    return { ct: Buffer.from('plain:' + String(plaintext), 'utf8') };
  }
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([
    cipher.update(String(plaintext), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return { ct, iv, tag };
}

function decrypt(envelope) {
  if (!envelope || !envelope.ct) return null;
  const key = getKey();
  // Plaintext passthrough (dev/test mode).
  if (key.length === 0) {
    const buf = Buffer.isBuffer(envelope.ct) ? envelope.ct : Buffer.from(envelope.ct);
    const text = buf.toString('utf8');
    if (text.startsWith('plain:')) return text.slice('plain:'.length);
    return text;
  }
  if (!envelope.iv || !envelope.tag) return null;
  const decipher = crypto.createDecipheriv(ALGO, key, envelope.iv);
  decipher.setAuthTag(envelope.tag);
  const pt = Buffer.concat([
    decipher.update(envelope.ct),
    decipher.final(),
  ]);
  return pt.toString('utf8');
}

// Convenience: serialize envelope as a single BYTEA blob for storage.
// Format: 1 byte version, 12 byte iv, 16 byte tag, N byte ciphertext.
function packEnvelope(envelope) {
  if (!envelope || !envelope.ct) return Buffer.alloc(0);
  if (!envelope.iv || !envelope.tag) return envelope.ct; // already packed or plaintext passthrough
  return Buffer.concat([
    Buffer.from([1]),
    envelope.iv,
    envelope.tag,
    envelope.ct,
  ]);
}

function unpackEnvelope(blob) {
  if (!blob) return { ct: null };
  const buf = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
  if (buf.length === 0) return { ct: null };
  if (buf[0] !== 1) {
    // Not versioned: treat as raw plaintext blob (dev mode or legacy row).
    return { ct: buf };
  }
  const iv = buf.subarray(1, 1 + IV_LEN);
  const tag = buf.subarray(1 + IV_LEN, 1 + IV_LEN + TAG_LEN);
  const ct = buf.subarray(1 + IV_LEN + TAG_LEN);
  return { ct, iv, tag };
}

module.exports = { encrypt, decrypt, packEnvelope, unpackEnvelope };
