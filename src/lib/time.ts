// All times are treated as a single office-local wall clock time (no timezone
// conversion), matching the "single office time zone" MVP scope.

export function toDateTimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function todayValue() {
  return toDateTimeLocalValue(new Date()).slice(0, 10)
}

export function formatTimeRange(start: string, end: string) {
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }
  return `${new Date(start).toLocaleTimeString([], opts)} – ${new Date(end).toLocaleTimeString([], opts)}`
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000)
}

export function roundToNext15(date: Date) {
  const rounded = new Date(date)
  rounded.setSeconds(0, 0)
  const remainder = rounded.getMinutes() % 15
  if (remainder !== 0) {
    rounded.setMinutes(rounded.getMinutes() + (15 - remainder))
  }
  return rounded
}

// The office's IANA time zone. Booking times are wall-clock values in this
// zone, so anything comparing them with "now" (check-in, auto-release,
// analytics) must read the clock here rather than the server's or browser's.
export const OFFICE_TIME_ZONE = 'Africa/Accra'

/** Current office wall-clock time as `YYYY-MM-DDTHH:mm`. */
export function officeNow(date: Date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: OFFICE_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

/**
 * Normalises a stored wall-clock value ("2026-01-05 09:00:00" from Postgres or
 * "2026-01-05T09:00" from a form) to `YYYY-MM-DDTHH:mm` so values compare
 * correctly as strings.
 */
export function normalizeWallClock(value: string) {
  return value.replace(' ', 'T').slice(0, 16)
}

/**
 * Parses a wall-clock string into a Date whose UTC fields hold the wall-clock
 * values. Only use it for arithmetic, never for display.
 */
export function wallClockToUtcDate(value: string) {
  return new Date(`${normalizeWallClock(value)}:00Z`)
}

export function utcDateToWallClock(date: Date) {
  return date.toISOString().slice(0, 16)
}

/** Adds minutes to a wall-clock string, returning `YYYY-MM-DDTHH:mm`. */
export function shiftWallClock(value: string, minutes: number) {
  return utcDateToWallClock(addMinutes(wallClockToUtcDate(value), minutes))
}

/** Formats the time part of a wall-clock string, e.g. "9:05 AM". */
export function formatTime(value: string) {
  return new Date(normalizeWallClock(value)).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}
