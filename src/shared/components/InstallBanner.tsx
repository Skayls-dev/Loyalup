import { useEffect, useMemo, useState } from 'react'
import { useInstallPrompt } from '../hooks/useInstallPrompt'

const DISMISS_KEY = 'pwa:install-banner-dismissed-until'
const DISMISS_DAYS = 7

function getDismissedUntil(): number {
  const value = localStorage.getItem(DISMISS_KEY)
  if (!value) {
    return 0
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function InstallBanner() {
  const { canInstall, isInstalled, promptInstall } = useInstallPrompt()
  const [hiddenByUser, setHiddenByUser] = useState(false)

  useEffect(() => {
    if (getDismissedUntil() > Date.now()) {
      setHiddenByUser(true)
    }
  }, [])

  const visible = useMemo(() => canInstall && !isInstalled && !hiddenByUser, [canInstall, isInstalled, hiddenByUser])

  const onDismiss = () => {
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000
    localStorage.setItem(DISMISS_KEY, String(until))
    setHiddenByUser(true)
  }

  const onInstall = async () => {
    const accepted = await promptInstall()
    if (accepted) {
      setHiddenByUser(true)
    }
  }

  if (!visible) {
    return null
  }

  return (
    <section className="fixed inset-x-0 bottom-4 z-50 mx-auto w-[calc(100%-1rem)] max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-4 text-zinc-100 shadow-2xl shadow-black/40">
      <p className="text-sm font-semibold">Installer Looyaal sur votre écran d'accueil</p>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            onInstall().catch(() => null)
          }}
          className="flex-1 rounded-lg bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-900"
        >
          Installer
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300"
        >
          Plus tard
        </button>
      </div>
    </section>
  )
}
