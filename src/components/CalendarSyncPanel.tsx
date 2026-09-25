import { useEffect, useState } from 'react'
import { CalendarPlus, Check, Copy, RefreshCw } from 'lucide-react'
import { regenerateMyCalendarToken } from '../server/calendar.functions.js'
import { feedUrl, googleCalendarSubscribeUrl } from '../lib/calendar.js'

export function CalendarSyncPanel({ token }: { token: string }) {
  const [currentToken, setCurrentToken] = useState(token)
  // The origin is only known in the browser; render the URL after hydration.
  const [origin, setOrigin] = useState('')
  const [copied, setCopied] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => setOrigin(window.location.origin), [])

  const url = origin ? feedUrl(origin, currentToken) : ''

  async function handleCopy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleReset() {
    if (
      !confirm(
        'Reset your calendar link? Calendars subscribed to the old link will stop updating.',
      )
    ) {
      return
    }
    setResetting(true)
    try {
      setCurrentToken(await regenerateMyCalendarToken())
    } finally {
      setResetting(false)
    }
  }

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-4 mb-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-medium text-slate-900 flex items-center gap-2">
            <CalendarPlus className="w-4 h-4 text-brand-600" />
            Sync with Google Calendar
          </h2>
          <p className="text-sm text-slate-500 mt-1 max-w-xl">
            Subscribe once and your bookings, including meetings you're invited
            to, appear in Google Calendar automatically. Google refreshes
            subscribed calendars every few hours. The link also works in Outlook
            and Apple Calendar.
          </p>
        </div>
        <a
          href={url ? googleCalendarSubscribeUrl(url) : undefined}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-md"
        >
          Add to Google Calendar
        </a>
      </div>
      <div className="mt-3 flex gap-2 items-center">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
          aria-label="Private calendar feed URL"
          className="flex-1 min-w-0 rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 font-mono"
        />
        <button
          onClick={handleCopy}
          disabled={!url}
          className="text-sm text-slate-700 px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 flex items-center gap-1"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-600" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button
          onClick={handleReset}
          disabled={resetting}
          title="Reset link"
          aria-label="Reset calendar link"
          className="text-slate-500 hover:text-slate-800 px-2 py-1.5 rounded-md border border-slate-200 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${resetting ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <p className="text-xs text-slate-400 mt-2">
        Keep this link private — anyone with it can see your bookings.
      </p>
    </section>
  )
}
