import { beforeEach, describe, expect, it } from 'vitest'
import { CryptoError } from '../crypto/encryption'
import {
  clearVault,
  initializeVault,
  loadPersistedVault,
  saveVaultPayload,
  unlockVault,
  vaultExists,
} from './vaultStore'

describe('vaultStore', () => {
  beforeEach(() => {
    clearVault()
  })

  it('starts with no vault', () => {
    expect(vaultExists()).toBe(false)
    expect(loadPersistedVault()).toBeNull()
  })

  it('initializes with a master password and stores only ciphertext', async () => {
    await initializeVault('super-secure-pass')
    expect(vaultExists()).toBe(true)

    const persisted = loadPersistedVault()
    expect(persisted).toBeTruthy()
    const raw = localStorage.getItem('vault.v1')!
    expect(raw).not.toContain('super-secure-pass')
    expect(raw).not.toContain('"entries":[]')
    expect(persisted!.data?.ciphertext).toBeTruthy()
  })

  it('unlocks with the correct password and rejects a wrong one', async () => {
    await initializeVault('correct-master-pw')
    const { payload } = await unlockVault('correct-master-pw')
    expect(payload.entries).toEqual([])

    await expect(unlockVault('wrong-master-pw')).rejects.toBeInstanceOf(CryptoError)
  })

  it('round-trips encrypted entries through save + unlock', async () => {
    const key = await initializeVault('master-password-ok')
    await saveVaultPayload(
      {
        version: 1,
        entries: [
          {
            id: 'e1',
            title: 'GitHub',
            username: 'jai',
            password: 'plain-secret',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
      key,
    )

    const raw = localStorage.getItem('vault.v1')!
    expect(raw).not.toContain('plain-secret')
    expect(raw).not.toContain('GitHub')

    const unlocked = await unlockVault('master-password-ok')
    expect(unlocked.payload.entries).toHaveLength(1)
    expect(unlocked.payload.entries[0]?.password).toBe('plain-secret')
  })
})
