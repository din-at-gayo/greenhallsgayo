import { useState } from 'react'
import { Download, Share, SquarePlus, X } from 'lucide-react'
import { useInstallPrompt } from '../../lib/pwa.js'

export function InstallButton() {
  const state = useInstallPrompt()
  const [showIosHelp, setShowIosHelp] = useState(false)

  if (state.kind === 'unavailable') return null

  return (
    <>
      <button
        type="button"
        onClick={() =>
          state.kind === 'prompt' ? state.install() : setShowIosHelp(true)
        }
        className="flex items-center gap-1.5 rounded-md border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100"
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">Install app</span>
        <span className="sm:hidden">Install</span>
      </button>

      {showIosHelp && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center"
          onClick={() => setShowIosHelp(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
            className="w-full max-w-sm rounded-t-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <img src="/icons/icon-192.png" alt="" className="h-10 w-10 rounded-xl" />
                <h2 id="ios-install-title" className="font-semibold text-slate-900">
                  Install RoomBook
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowIosHelp(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ol className="space-y-3 text-sm text-slate-700">
              <li className="flex items-center gap-2">
                <span className="font-semibold">1.</span> Tap
                <Share className="h-4 w-4 text-brand-600" />
                <span className="font-medium">Share</span> in Safari's toolbar.
              </li>
              <li className="flex items-center gap-2">
                <span className="font-semibold">2.</span> Choose
                <SquarePlus className="h-4 w-4 text-brand-600" />
                <span className="font-medium">Add to Home Screen</span>.
              </li>
              <li className="flex items-center gap-2">
                <span className="font-semibold">3.</span> Tap
                <span className="font-medium">Add</span>, then open RoomBook from
                your home screen.
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  )
}
