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
