/**
 * Local-only vault persistence. All ciphertext stays in localStorage
 * under the workspace-origin browser profile — no network I/O.
 */

import {
  createMasterVerifier,
  decryptVaultPayload,
  encryptVaultPayload,
  unlockWithMasterPassword,
  type EncryptedBlob,
} from '../crypto/encryption'
import type { PersistedVault, VaultPayload } from './types'

export const VAULT_STORAGE_KEY = 'vault.v1'

const EMPTY_PAYLOAD: VaultPayload = { version: 1, entries: [] }

export function loadPersistedVault(): PersistedVault | null {
  const raw = localStorage.getItem(VAULT_STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as PersistedVault
    if (parsed?.version !== 1 || !parsed.verifier?.salt) return null
    return parsed
  } catch {
    return null
  }
}

export function vaultExists(): boolean {
  return loadPersistedVault() !== null
}

function writePersistedVault(vault: PersistedVault): void {
  localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(vault))
}

/** First-run: derive salt/verifier and persist an empty encrypted vault. */
export async function initializeVault(masterPassword: string): Promise<CryptoKey> {
  if (masterPassword.length < 8) {
    throw new Error('Master password must be at least 8 characters')
  }
  if (vaultExists()) {
    throw new Error('Vault already initialized')
  }

  const verifier = await createMasterVerifier(masterPassword)
  const key = await unlockWithMasterPassword(masterPassword, verifier)
  const encrypted = await encryptVaultPayload(EMPTY_PAYLOAD, key)

  writePersistedVault({
    version: 1,
    verifier,
    data: encrypted,
  })

  return key
}

/** Subsequent launches: validate master password and return session key. */
export async function unlockVault(masterPassword: string): Promise<{
  key: CryptoKey
  payload: VaultPayload
}> {
  const persisted = loadPersistedVault()
  if (!persisted) {
    throw new Error('No vault found — create a master password first')
  }

  const verifier: EncryptedBlob = persisted.verifier
  const key = await unlockWithMasterPassword(masterPassword, verifier)

  if (!persisted.data) {
    return { key, payload: EMPTY_PAYLOAD }
  }

  const payload = await decryptVaultPayload<VaultPayload>(
    persisted.data.ciphertext,
    persisted.data.iv,
    key,
  )

  return { key, payload }
}

/** Persist an updated payload using the unlocked session key. */
export async function saveVaultPayload(
  payload: VaultPayload,
  key: CryptoKey,
): Promise<void> {
  const persisted = loadPersistedVault()
  if (!persisted) {
    throw new Error('No vault found')
  }
  const encrypted = await encryptVaultPayload(payload, key)
  writePersistedVault({
    ...persisted,
    data: encrypted,
  })
}

/** Dev/test helper — wipes local vault. */
export function clearVault(): void {
  localStorage.removeItem(VAULT_STORAGE_KEY)
}
