import { AnimatePresence, motion } from 'framer-motion'
import { Check, Copy, Eye, EyeOff, Plus, RefreshCw, Search, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { generateSecurePassword } from '../lib/generatePassword'
import type { VaultEntry } from '../storage/types'

type VaultDashboardProps = {
  entries: VaultEntry[]
  busy: boolean
  onAdd: (input: { title: string; username: string; password: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onLock: () => void
}

function newId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `e_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function createEntry(input: {
  title: string
  username: string
  password: string
}): VaultEntry {
  const now = new Date().toISOString()
  return {
    id: newId(),
    title: input.title.trim(),
    username: input.username.trim(),
    password: input.password,
    createdAt: now,
    updatedAt: now,
  }
}

export function VaultDashboard({
  entries,
  busy,
  onAdd,
  onDelete,
  onLock,
}: VaultDashboardProps) {
  const [title, setTitle] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showFormPassword, setShowFormPassword] = useState(false)
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(entries.length === 0)
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const filtered = !q
    ? entries
    : entries.filter(
        (entry) =>
          entry.title.toLowerCase().includes(q) || entry.username.toLowerCase().includes(q),
      )

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!title.trim() || !username.trim() || !password) {
      setFormError('Title, username, and password are required')
      return
    }
    try {
      await onAdd({ title, username, password })
      setTitle('')
      setUsername('')
      setPassword('')
      setFormOpen(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save entry')
    }
  }

  async function copyPassword(entry: VaultEntry) {
    try {
      await navigator.clipboard.writeText(entry.password)
      setCopiedId(entry.id)
      window.setTimeout(() => {
        setCopiedId((current) => (current === entry.id ? null : current))
      }, 1400)
    } catch {
      setFormError('Clipboard unavailable in this environment')
    }
  }

  return (
    <main className="vault-shell">
      <header className="vault-header">
        <div>
          <p className="auth-eyebrow">Local vault · {entries.length} saved</p>
          <h1 className="vault-title">vault</h1>
        </div>
        <div className="vault-header-actions">
          <button
            type="button"
            className="ghost-btn"
            onClick={() => setFormOpen((v) => !v)}
            disabled={busy}
          >
            <Plus size={15} strokeWidth={1.75} />
            {formOpen ? 'Close' : 'Add'}
          </button>
          <button type="button" className="ghost-btn" onClick={onLock}>
            Lock
          </button>
        </div>
      </header>

      <AnimatePresence>
        {copiedId && (
          <motion.div
            className="copy-toast"
            role="status"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
          >
            Copied to clipboard
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {formOpen && (
          <motion.form
            className="entry-form"
            onSubmit={handleAdd}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="entry-form-grid">
              <label className="field">
                <span className="field-label">Title</span>
                <div className="field-control bare">
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="GitHub"
                    disabled={busy}
                    autoFocus
                  />
                </div>
              </label>
              <label className="field">
                <span className="field-label">Username</span>
                <div className="field-control bare">
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="you@example.com"
                    disabled={busy}
                    autoComplete="off"
                  />
                </div>
              </label>
              <label className="field entry-form-password">
                <span className="field-label">Password</span>
                <div className="field-control password-field">
                  <input
                    type={showFormPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    disabled={busy}
                    autoComplete="new-password"
                    spellCheck={false}
                    style={{ paddingLeft: '0.95rem', paddingRight: '5.5rem' }}
                  />
                  <div className="field-toggle-group">
                    <button
                      type="button"
                      className="field-toggle"
                      onClick={() => {
                        setPassword(generateSecurePassword())
                        setShowFormPassword(true)
                      }}
                      aria-label="Generate strong password"
                      tabIndex={-1}
                    >
                      <RefreshCw size={15} />
                    </button>
                    <button
                      type="button"
                      className="field-toggle"
                      onClick={() => setShowFormPassword((v) => !v)}
                      aria-label={showFormPassword ? 'Hide password' : 'Show password'}
                      tabIndex={-1}
                    >
                      {showFormPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </label>
            </div>

            {formError && (
              <p className="auth-error" role="alert">
                {formError}
              </p>
            )}

            <button type="submit" className="auth-submit compact" disabled={busy}>
              {busy ? 'Saving…' : 'Save to vault'}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {entries.length > 0 && (
        <label className="field search-field">
          <span className="field-label">Search</span>
          <div className="field-control">
            <Search size={16} strokeWidth={1.5} className="field-icon" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by title or username"
              disabled={busy}
            />
          </div>
        </label>
      )}

      <section className="entry-list" aria-label="Saved passwords">
        {entries.length === 0 ? (
          <div className="entry-empty">
            <p>No passwords yet.</p>
            <p className="entry-empty-sub">Add an account — it stays encrypted on this device.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="entry-empty">
            <p>No matches.</p>
            <p className="entry-empty-sub">Try a different search.</p>
          </div>
        ) : (
          <ul>
            <AnimatePresence initial={false}>
              {filtered.map((entry, index) => {
                const isRevealed = !!revealed[entry.id]
                const justCopied = copiedId === entry.id
                return (
                  <motion.li
                    key={entry.id}
                    className="entry-row"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{
                      duration: 0.3,
                      delay: Math.min(index * 0.03, 0.18),
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <div className="entry-meta">
                      <h2>{entry.title}</h2>
                      <p>{entry.username}</p>
                      <code className="entry-secret">
                        {isRevealed ? entry.password : '••••••••••••'}
                      </code>
                    </div>
                    <div className="entry-actions">
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() =>
                          setRevealed((prev) => ({
                            ...prev,
                            [entry.id]: !prev[entry.id],
                          }))
                        }
                        aria-label={isRevealed ? 'Hide password' : 'Reveal password'}
                      >
                        {isRevealed ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => void copyPassword(entry)}
                        aria-label="Copy password"
                      >
                        {justCopied ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                      <button
                        type="button"
                        className="icon-btn danger"
                        onClick={() => void onDelete(entry.id)}
                        aria-label="Delete entry"
                        disabled={busy}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        )}
      </section>
    </main>
  )
}
