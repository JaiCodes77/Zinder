import { describe, expect, it } from 'vitest'
import {
  CRYPTO_PARAMS,
  CryptoError,
  createMasterVerifier,
  decryptVaultPayload,
  encryptVaultPayload,
  unlockWithMasterPassword,
} from './encryption'

describe('encryption core', () => {
  it('exposes hardened PBKDF2 + AES-GCM parameters', () => {
    expect(CRYPTO_PARAMS.iterations).toBeGreaterThanOrEqual(310_000)
    expect(CRYPTO_PARAMS.keyBits).toBe(256)
    expect(CRYPTO_PARAMS.algorithm).toBe('AES-GCM')
  })

  it('creates a verifier and unlocks with the correct master password', async () => {
    const password = 'correct horse battery staple'
    const verifier = await createMasterVerifier(password)
    expect(verifier.salt).toBeTruthy()
    expect(verifier.iv).toBeTruthy()
    expect(verifier.ciphertext).toBeTruthy()

    const key = await unlockWithMasterPassword(password, verifier)
    expect(key).toBeTruthy()
    expect(key.algorithm.name).toBe('AES-GCM')
  })

  it('rejects an incorrect master password', async () => {
    const verifier = await createMasterVerifier('right-password')
    await expect(unlockWithMasterPassword('wrong-password', verifier)).rejects.toBeInstanceOf(
      CryptoError,
    )
  })

  it('round-trips vault payload encryption without plaintext leakage', async () => {
    const password = 'vault-secret'
    const verifier = await createMasterVerifier(password)
    const key = await unlockWithMasterPassword(password, verifier)

    const payload = {
      entries: [{ id: '1', title: 'GitHub', username: 'jai', password: 's3cret!' }],
    }

    const encrypted = await encryptVaultPayload(payload, key)
    expect(encrypted.ciphertext).not.toContain('s3cret!')
    expect(encrypted.ciphertext).not.toContain('GitHub')

    const decrypted = await decryptVaultPayload<typeof payload>(
      encrypted.ciphertext,
      encrypted.iv,
      key,
    )
    expect(decrypted).toEqual(payload)
  })

  it('fails decryption with a different derived key', async () => {
    const a = await createMasterVerifier('alpha')
    const b = await createMasterVerifier('beta')
    const keyA = await unlockWithMasterPassword('alpha', a)
    const keyB = await unlockWithMasterPassword('beta', b)

    const encrypted = await encryptVaultPayload({ ok: true }, keyA)
    await expect(
      decryptVaultPayload(encrypted.ciphertext, encrypted.iv, keyB),
    ).rejects.toBeInstanceOf(CryptoError)
  })
})
