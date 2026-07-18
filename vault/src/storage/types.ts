export type VaultEntry = {
  id: string
  title: string
  username: string
  password: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export type VaultPayload = {
  version: 1
  entries: VaultEntry[]
}

export type PersistedVault = {
  version: 1
  /** Master-password verifier (salt + encrypted known plaintext) */
  verifier: {
    salt: string
    iv: string
    ciphertext: string
  }
  /** Encrypted VaultPayload; null until first save after unlock */
  data: {
    iv: string
    ciphertext: string
  } | null
}
