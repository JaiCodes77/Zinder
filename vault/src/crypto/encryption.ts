/**
 * Local-only cryptography for the Vault password manager.
 * Uses Web Crypto API exclusively — no network, no remote key material.
 *
 * Key derivation: PBKDF2-SHA-256 (310_000 iterations) → AES-256-GCM key
 * Payload: random 12-byte IV + ciphertext + auth tag (bundled by AES-GCM)
 */

const PBKDF2_ITERATIONS = 310_000
const SALT_BYTES = 16
const IV_BYTES = 12
const KEY_BITS = 256
const VERIFIER_PLAINTEXT = 'vault-v1'

export class CryptoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CryptoError'
  }
}

export type EncryptedBlob = {
  /** base64 salt used for PBKDF2 */
  salt: string
  /** base64 AES-GCM IV */
  iv: string
  /** base64 ciphertext (includes GCM auth tag) */
  ciphertext: string
}

function requireSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    throw new CryptoError('Web Crypto API is unavailable in this environment')
  }
  return subtle
}

/** Narrow Uint8Array to BufferSource for Web Crypto DOM typings. */
function asBufferSource(bytes: Uint8Array): BufferSource {
  return bytes as BufferSource
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  globalThis.crypto.getRandomValues(bytes)
  return bytes
}

async function importPasswordKey(password: string): Promise<CryptoKey> {
  const subtle = requireSubtle()
  const encoded = new TextEncoder().encode(password)
  return subtle.importKey('raw', encoded, 'PBKDF2', false, ['deriveKey'])
}

export async function deriveVaultKey(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  if (!password) {
    throw new CryptoError('Master password is required')
  }
  const subtle = requireSubtle()
  const baseKey = await importPasswordKey(password)
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: asBufferSource(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: KEY_BITS },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptString(
  plaintext: string,
  key: CryptoKey,
): Promise<{ iv: string; ciphertext: string }> {
  const subtle = requireSubtle()
  const iv = randomBytes(IV_BYTES)
  const encoded = new TextEncoder().encode(plaintext)
  const cipherBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv: asBufferSource(iv) },
    key,
    encoded,
  )
  return {
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(cipherBuffer)),
  }
}

export async function decryptString(
  ciphertextB64: string,
  ivB64: string,
  key: CryptoKey,
): Promise<string> {
  const subtle = requireSubtle()
  try {
    const plainBuffer = await subtle.decrypt(
      { name: 'AES-GCM', iv: asBufferSource(base64ToBytes(ivB64)) },
      key,
      asBufferSource(base64ToBytes(ciphertextB64)),
    )
    return new TextDecoder().decode(plainBuffer)
  } catch {
    throw new CryptoError('Decryption failed — incorrect master password or corrupted data')
  }
}

/** Create a new salt + encrypt a verifier so we can validate the master password later. */
export async function createMasterVerifier(password: string): Promise<EncryptedBlob> {
  const salt = randomBytes(SALT_BYTES)
  const key = await deriveVaultKey(password, salt)
  const { iv, ciphertext } = await encryptString(VERIFIER_PLAINTEXT, key)
  return {
    salt: bytesToBase64(salt),
    iv,
    ciphertext,
  }
}

/** Unlock: derive key and confirm verifier decrypts. Returns CryptoKey on success. */
export async function unlockWithMasterPassword(
  password: string,
  verifier: EncryptedBlob,
): Promise<CryptoKey> {
  const salt = base64ToBytes(verifier.salt)
  const key = await deriveVaultKey(password, salt)
  const plaintext = await decryptString(verifier.ciphertext, verifier.iv, key)
  if (plaintext !== VERIFIER_PLAINTEXT) {
    throw new CryptoError('Incorrect master password')
  }
  return key
}

/** Encrypt arbitrary JSON-serializable vault payload with an unlocked key. */
export async function encryptVaultPayload(
  payload: unknown,
  key: CryptoKey,
): Promise<{ iv: string; ciphertext: string }> {
  return encryptString(JSON.stringify(payload), key)
}

/** Decrypt vault payload; throws CryptoError on wrong key / corruption. */
export async function decryptVaultPayload<T>(
  ciphertext: string,
  iv: string,
  key: CryptoKey,
): Promise<T> {
  const json = await decryptString(ciphertext, iv, key)
  try {
    return JSON.parse(json) as T
  } catch {
    throw new CryptoError('Vault data is corrupted')
  }
}

export const CRYPTO_PARAMS = {
  iterations: PBKDF2_ITERATIONS,
  saltBytes: SALT_BYTES,
  ivBytes: IV_BYTES,
  keyBits: KEY_BITS,
  algorithm: 'AES-GCM' as const,
} as const
