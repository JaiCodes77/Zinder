/**
 * End-to-end offline vault flow (no network):
 * init → unlock fail → unlock ok → add → persist → re-unlock → copy plaintext in memory only
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createEntry } from './components/VaultDashboard'
import {
  clearVault,
  initializeVault,
  loadPersistedVault,
  saveVaultPayload,
  unlockVault,
} from './storage/vaultStore'

describe('offline vault e2e', () => {
  beforeEach(() => {
    clearVault()
  })

  it('supports full local encrypted lifecycle', async () => {
    const master = 'ultra-local-master-99'
    await initializeVault(master)

    await expect(unlockVault('wrong')).rejects.toThrow()

    const first = await unlockVault(master)
    expect(first.payload.entries).toHaveLength(0)

    const entry = createEntry({
      title: 'Linear',
      username: 'jai',
      password: 'top-secret-value',
    })
    await saveVaultPayload({ version: 1, entries: [entry] }, first.key)

    const persisted = loadPersistedVault()
    const raw = JSON.stringify(persisted)
    expect(raw).not.toContain('top-secret-value')
    expect(raw).not.toContain(master)
    expect(raw).not.toContain('Linear')

    const second = await unlockVault(master)
    expect(second.payload.entries).toHaveLength(1)
    expect(second.payload.entries[0]?.password).toBe('top-secret-value')
    expect(second.payload.entries[0]?.title).toBe('Linear')
  })
})
