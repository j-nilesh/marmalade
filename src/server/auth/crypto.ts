import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
  createCipheriv,
  createDecipheriv,
} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const KEY_LEN = 64;
const LEGACY_DEFAULT_SECRET = 'sprout-local-key-encryption-secret-2026';

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, KEY_LEN).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  const derived = scryptSync(password, salt, KEY_LEN);
  const storedBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return timingSafeEqual(derived, storedBuf);
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateCsrfToken(): string {
  return randomBytes(24).toString('base64url');
}

/**
 * Returns the persistent secret string for encrypting API keys at rest.
 * Priority:
 * 1. Explicit environment variable: SESSION_SECRET or APP_KEY
 * 2. Persistent file: data/.encryption_secret (auto-generated 32-byte random hex on first boot)
 * 3. In-memory / legacy fallback
 */
function getPersistentSecret(): string {
  if (process.env.SESSION_SECRET?.trim()) {
    return process.env.SESSION_SECRET.trim();
  }
  if (process.env.APP_KEY?.trim()) {
    return process.env.APP_KEY.trim();
  }

  try {
    const dbPath =
      process.env.MARMALADE_DB_PATH ||
      process.env.SPROUT_DB_PATH ||
      path.join(process.cwd(), 'data', 'marmalade.db');
    const secretDir = path.dirname(dbPath);
    const secretPath = path.join(secretDir, '.encryption_secret');

    if (fs.existsSync(secretPath)) {
      const saved = fs.readFileSync(secretPath, 'utf8').trim();
      if (saved) return saved;
    }

    // Auto-generate a new cryptographically random 32-byte secret on first startup
    if (!fs.existsSync(secretDir)) {
      fs.mkdirSync(secretDir, { recursive: true });
    }
    const generated = randomBytes(32).toString('hex');
    fs.writeFileSync(secretPath, generated, { mode: 0o600 });
    return generated;
  } catch {
    // If directory is read-only or in-memory, fall back safely
    return LEGACY_DEFAULT_SECRET;
  }
}

/**
 * Derives a 32-byte AES-256 key from a given secret string.
 */
function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

/**
 * Encrypts an API key for storage at rest using AES-256-GCM.
 * Stored format: enc:v1:<ivHex>:<tagHex>:<ciphertextHex>
 */
export function encryptApiKey(plainKey: string): string {
  const trimmed = plainKey.trim();
  if (!trimmed) return '';
  // If already encrypted, return as is
  if (trimmed.startsWith('enc:v1:')) return trimmed;

  const key = deriveKey(getPersistentSecret());
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(trimmed, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `enc:v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts an API key from storage.
 * Gracefully tries the instance key first, then falls back to the legacy key
 * so existing installations never lose their keys.
 */
export function decryptApiKey(storedKey: string): string {
  const trimmed = (storedKey || '').trim();
  if (!trimmed) return '';
  if (!trimmed.startsWith('enc:v1:')) {
    // Unencrypted legacy key
    return trimmed;
  }

  const parts = trimmed.split(':');
  if (parts.length !== 5) return '';
  const [, , ivHex, tagHex, cipherHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const cipherBuffer = Buffer.from(cipherHex, 'hex');

  // Candidate keys: instance secret key, then legacy default
  const candidateKeys = [deriveKey(getPersistentSecret())];
  const legacyKey = deriveKey(LEGACY_DEFAULT_SECRET);
  if (!candidateKeys[0].equals(legacyKey)) {
    candidateKeys.push(legacyKey);
  }

  for (const key of candidateKeys) {
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([
        decipher.update(cipherBuffer),
        decipher.final(),
      ]);
      return decrypted.toString('utf8');
    } catch {
      // Try next candidate key
    }
  }

  console.error('Failed to decrypt stored API key with any available key.');
  return '';
}
