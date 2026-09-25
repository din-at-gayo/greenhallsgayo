// Recurrence math on wall-clock `YYYY-MM-DDTHH:mm` strings. Values are parsed
// as UTC purely as a calendar-arithmetic device, so daylight-saving shifts
// never move a meeting's wall-clock time.

export const RECURRENCE_FREQUENCIES = [
  'daily',
  'weekly',
  'biweekly',
  'monthly',
] as const

export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number]

export const MAX_OCCURRENCES = 5

export const RECURRENCE_LABELS: Record<RecurrenceFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
}

export type Occurrence = { startTime: string; endTime: string }

function parseWallClock(value: string) {
  const [date, time = '00:00'] = value.split('T')
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return new Date(Date.UTC(y, m - 1, d, hh, mm))
}

function formatWallClock(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
}

function shift(start: Date, frequency: RecurrenceFrequency, index: number) {
  const next = new Date(start)
  if (frequency === 'daily') next.setUTCDate(start.getUTCDate() + index)
  if (frequency === 'weekly') next.setUTCDate(start.getUTCDate() + 7 * index)
  if (frequency === 'biweekly') next.setUTCDate(start.getUTCDate() + 14 * index)
  if (frequency === 'monthly') {
    // Keep the same day of month, clamped to the last day of shorter months.
    const targetMonth = start.getUTCMonth() + index
    const lastDay = new Date(
      Date.UTC(start.getUTCFullYear(), targetMonth + 1, 0),
    ).getUTCDate()
    next.setUTCDate(1)
    next.setUTCMonth(targetMonth)
    next.setUTCDate(Math.min(start.getUTCDate(), lastDay))
  }
  return next
}

/** Expands a booking into its occurrences (the first one is the original). */
export function expandOccurrences(
  startTime: string,
  endTime: string,
  frequency: RecurrenceFrequency | null,
  count: number,
): Array<Occurrence> {
  const start = parseWallClock(startTime)
  const durationMs = parseWallClock(endTime).getTime() - start.getTime()
  const total = frequency ? Math.min(Math.max(count, 1), MAX_OCCURRENCES) : 1

  return Array.from({ length: total }, (_, i) => {
    const occurrenceStart = frequency ? shift(start, frequency, i) : start
    return {
      startTime: formatWallClock(occurrenceStart),
      endTime: formatWallClock(
        new Date(occurrenceStart.getTime() + durationMs),
      ),
    }
  })
}
