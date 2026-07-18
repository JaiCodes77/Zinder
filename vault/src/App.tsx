import { useEffect, useState } from 'react'
import { AuthScreen } from './components/AuthScreen'
import { InstallBanner } from './components/InstallBanner'
import { createEntry, VaultDashboard } from './components/VaultDashboard'
import { CryptoError } from './crypto/encryption'
import type { VaultPayload } from './storage/types'
import {
  initializeVault,
  saveVaultPayload,
  unlockVault,
  vaultExists,
} from './storage/vaultStore'

type Session = {
  key: CryptoKey
  payload: VaultPayload
}

type Phase = 'boot' | 'setup' | 'unlock' | 'vault'

export default function App() {
  const [phase, setPhase] = useState<Phase>('boot')
  const [session, setSession] = useState<Session | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setPhase(vaultExists() ? 'unlock' : 'setup')
  }, [])

  async function handleAuth(password: string, confirm?: string) {
    setError(null)
    setBusy(true)
    try {
      if (phase === 'setup') {
        if (password !== confirm) {
          throw new Error('Passwords do not match')
        }
        const key = await initializeVault(password)
        setSession({ key, payload: { version: 1, entries: [] } })
        setPhase('vault')
        return
      }

      const unlocked = await unlockVault(password)
      setSession(unlocked)
      setPhase('vault')
    } catch (err) {
      if (err instanceof CryptoError) {
        setError('Incorrect master password')
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Something went wrong')
      }
    } finally {
      setBusy(false)
    }
  }

  async function persist(next: VaultPayload, key: CryptoKey) {
    setSaving(true)
    try {
      await saveVaultPayload(next, key)
      setSession({ key, payload: next })
    } finally {
      setSaving(false)
    }
  }

  async function handleAdd(input: { title: string; username: string; password: string }) {
    if (!session) return
    const entry = createEntry(input)
    const next: VaultPayload = {
      version: 1,
      entries: [entry, ...session.payload.entries],
    }
    await persist(next, session.key)
  }

  async function handleDelete(id: string) {
    if (!session) return
    const next: VaultPayload = {
      version: 1,
      entries: session.payload.entries.filter((entry) => entry.id !== id),
    }
    await persist(next, session.key)
  }

  function lock() {
    setSession(null)
    setError(null)
    setPhase(vaultExists() ? 'unlock' : 'setup')
  }

  if (phase === 'boot') {
    return <main className="auth-shell" aria-busy="true" />
  }

  if (phase === 'setup' || phase === 'unlock') {
    return (
      <>
        <AuthScreen mode={phase} busy={busy} error={error} onSubmit={handleAuth} />
        <InstallBanner />
      </>
    )
  }

  return (
    <>
      <VaultDashboard
        entries={session?.payload.entries ?? []}
        busy={saving}
        onAdd={handleAdd}
        onDelete={handleDelete}
        onLock={lock}
      />
      <InstallBanner />
    </>
  )
}
