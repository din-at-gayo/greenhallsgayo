import { useEffect, useState, useSyncExternalStore } from 'react'

/** Registers /sw.js once the page has loaded. Safe to call more than once. */
export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  // Skip on the Vite dev server so cached assets don't fight hot reload.
  if (import.meta.env.DEV) return
  const register = () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
      console.warn('Service worker registration failed', err)
    })
  }
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

/** True while the browser reports a network connection (always true during SSR). */
export function useOnlineStatus() {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  )
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIos() {
  const ua = navigator.userAgent
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
  )
}

export type InstallState =
  | { kind: 'unavailable' }
  | { kind: 'prompt'; install: () => Promise<void> }
  | { kind: 'ios' }

/**
 * Exposes how the app can be installed on this device: a native prompt
 * (Chrome/Edge/Android), manual "Add to Home Screen" instructions (iOS Safari),
 * or nothing when already installed or unsupported.
 */
export function useInstallPrompt(): InstallState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [mode, setMode] = useState<'unknown' | 'installed' | 'ios' | 'other'>(
    'unknown',
  )

  useEffect(() => {
    if (isStandalone()) {
      setMode('installed')
      return
    }
    setMode(isIos() ? 'ios' : 'other')

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setDeferred(null)
      setMode('installed')
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (mode === 'installed' || mode === 'unknown') return { kind: 'unavailable' }
  if (deferred) {
    return {
      kind: 'prompt',
      install: async () => {
        await deferred.prompt()
        await deferred.userChoice
        setDeferred(null)
      },
    }
  }
  if (mode === 'ios') return { kind: 'ios' }
  return { kind: 'unavailable' }
}
