import { AnimatePresence, motion } from 'framer-motion'
import { Eye, EyeOff, Lock, Shield } from 'lucide-react'
import { useState, type FormEvent } from 'react'

type Mode = 'setup' | 'unlock'

type AuthScreenProps = {
  mode: Mode
  busy: boolean
  error: string | null
  onSubmit: (password: string, confirm?: string) => void
}

export function AuthScreen({ mode, busy, error, onSubmit }: AuthScreenProps) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (mode === 'setup') {
      onSubmit(password, confirm)
    } else {
      onSubmit(password)
    }
  }

  const isSetup = mode === 'setup'

  return (
    <main className="auth-shell">
      <motion.div
        className="auth-panel"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="auth-brand">
          <span className="auth-mark" aria-hidden>
            <Shield size={18} strokeWidth={1.5} />
          </span>
          <p className="auth-eyebrow">Offline · Encrypted</p>
          <h1 className="auth-title">vault</h1>
          <p className="auth-sub">
            {isSetup
              ? 'Create a master password. It never leaves this device — lose it and the vault is unrecoverable.'
              : 'Enter your master password to unlock the local vault.'}
          </p>
          <p className="auth-local-badge">100% local · no network</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} autoComplete="off">
          <label className="field">
            <span className="field-label">Master password</span>
            <div className="field-control">
              <Lock size={16} strokeWidth={1.5} className="field-icon" aria-hidden />
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSetup ? 'At least 8 characters' : 'Your master password'}
                minLength={isSetup ? 8 : 1}
                required
                autoFocus
                disabled={busy}
                spellCheck={false}
              />
              <button
                type="button"
                className="field-toggle"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          <AnimatePresence initial={false}>
            {isSetup && (
              <motion.label
                className="field"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <span className="field-label">Confirm password</span>
                <div className="field-control">
                  <Lock size={16} strokeWidth={1.5} className="field-icon" aria-hidden />
                  <input
                    type={show ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter master password"
                    minLength={8}
                    required
                    disabled={busy}
                    spellCheck={false}
                  />
                </div>
              </motion.label>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {error && (
              <motion.p
                className="auth-error"
                role="alert"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <button type="submit" className="auth-submit" disabled={busy}>
            {busy ? 'Working…' : isSetup ? 'Create vault' : 'Unlock'}
          </button>
        </form>
      </motion.div>
    </main>
  )
}
