import { useEffect, useState } from 'react'
import { CheckCircle2, Clock, LogIn } from 'lucide-react'
import { checkInBooking } from '../server/bookings.functions.js'
import {
  CHECK_IN_OPENS_BEFORE_MINUTES,
  getCheckInState,
  releaseDeadline,
} from '../lib/checkin.js'
import {
  formatTime,
  normalizeWallClock,
  officeNow,
  shiftWallClock,
} from '../lib/time.js'

/** Office wall-clock "now", refreshed every 20 seconds. */
export function useOfficeNow() {
  const [now, setNow] = useState(() => officeNow())
  useEffect(() => {
    const id = setInterval(() => setNow(officeNow()), 20_000)
    return () => clearInterval(id)
  }, [])
  return now
}

type CheckInBooking = {
  id: number
  status: string
  startTime: string
  endTime: string
  createdAt: string
  checkedInAt: string | null
}

/**
 * Check-in button plus status for a single booking. `canCheckIn` hides the
 * button for people who are not the organizer (the server enforces this too).
 */
export function CheckInControl({
  booking,
  now,
  canCheckIn = true,
  onCheckedIn,
}: {
  booking: CheckInBooking
  now: string
  canCheckIn?: boolean
  onCheckedIn: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const state = getCheckInState(booking, now)

  async function handleCheckIn() {
    setBusy(true)
    setError(null)
    try {
      const result = await checkInBooking({ data: { id: booking.id } })
      if ('error' in result) {
        setError(result.error ?? 'Could not check in')
        onCheckedIn() // refresh: the booking may have just been released
      } else {
        onCheckedIn()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check in')
    } finally {
      setBusy(false)
    }
  }

  if (state === 'checked_in') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 bg-brand-50 rounded px-2 py-1">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Checked in {booking.checkedInAt ? formatTime(booking.checkedInAt) : ''}
      </span>
    )
  }

  if (state === 'open') {
    const deadline = releaseDeadline(booking.startTime, booking.createdAt)
    return (
      <div className="flex flex-col items-start gap-1">
        {canCheckIn ? (
          <button
            onClick={handleCheckIn}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-md disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />
            {busy ? 'Checking in…' : 'Check in'}
          </button>
        ) : null}
        <span className="text-xs text-amber-700">
          Released at {formatTime(deadline)} if no one checks in
        </span>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    )
  }

  if (state === 'not_open' && now.slice(0, 10) === booking.startTime.slice(0, 10)) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
        <Clock className="w-3.5 h-3.5" />
        Check-in opens{' '}
        {formatTime(
          shiftWallClock(booking.startTime, -CHECK_IN_OPENS_BEFORE_MINUTES),
        )}
      </span>
    )
  }

  // Meeting over without a check-in: nothing to act on any more.
  if (state === 'missed' && now < normalizeWallClock(booking.endTime)) {
    return (
      <span className="text-xs text-amber-700">Releasing — no check-in</span>
    )
  }

  return null
}
