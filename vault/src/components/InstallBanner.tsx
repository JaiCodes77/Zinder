import { AnimatePresence, motion } from 'framer-motion'
import { Download, Share, X } from 'lucide-react'
import { useInstallPrompt } from '../pwa/useInstallPrompt'

export function InstallBanner() {
  const { mode, install, dismiss } = useInstallPrompt()

  return (
    <AnimatePresence>
      {mode !== 'hidden' && (
        <motion.aside
          className="install-banner"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          aria-label="Install Vault"
        >
          <div className="install-banner-copy">
            <p className="install-banner-title">Install Vault</p>
            {mode === 'ios' ? (
              <p className="install-banner-sub">
                On iPhone: tap <Share size={13} className="inline-icon" aria-hidden /> Share, then{' '}
                <strong>Add to Home Screen</strong>.
              </p>
            ) : (
              <p className="install-banner-sub">
                Add to your desktop or home screen — works offline, fully local.
              </p>
            )}
          </div>
          <div className="install-banner-actions">
            {mode === 'chromium' && (
              <button type="button" className="auth-submit compact" onClick={() => void install()}>
                <Download size={14} strokeWidth={1.75} />
                Install
              </button>
            )}
            <button type="button" className="icon-btn" onClick={dismiss} aria-label="Dismiss install tip">
              <X size={16} />
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
