import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return iOS
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const media = window.matchMedia('(display-mode: standalone)').matches
  const iosStandalone = 'standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return media || iosStandalone
}

export type InstallMode = 'hidden' | 'chromium' | 'ios'

export function useInstallPrompt() {
  const [mode, setMode] = useState<InstallMode>('hidden')
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem('vault.install.dismissed') === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (isStandalone() || dismissed) {
      setMode('hidden')
      return
    }

    if (isIos()) {
      setMode('ios')
      return
    }

    function onBip(e: Event) {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setMode('chromium')
    }

    window.addEventListener('beforeinstallprompt', onBip)
    return () => window.removeEventListener('beforeinstallprompt', onBip)
  }, [dismissed])

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
    setMode('hidden')
  }

  function dismiss() {
    try {
      localStorage.setItem('vault.install.dismissed', '1')
    } catch {
      /* ignore */
    }
    setDismissed(true)
    setMode('hidden')
  }

  return { mode, install, dismiss, isStandalone: isStandalone() }
}
