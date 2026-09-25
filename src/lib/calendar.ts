// Helpers for handing bookings to external calendars. Times are floating
// wall-clock values, so calendars show them in the viewer's own time zone —
// consistent with the single-office scope described in src/lib/time.ts.

/** `YYYY-MM-DD[T ]HH:mm[:ss]` -> `YYYYMMDDTHHmm00` (iCal / Google floating time). */
export function toCalendarStamp(value: string) {
  const [date, time = '00:00'] = value.split(/[T ]/)
  const [hh = '00', mm = '00'] = time.split(':')
  return `${date.replaceAll('-', '')}T${hh}${mm}00`
}

export function googleCalendarEventUrl(booking: {
  title: string
  description?: string | null
  startTime: string
  endTime: string
  location?: string
}) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: booking.title,
    dates: `${toCalendarStamp(booking.startTime)}/${toCalendarStamp(booking.endTime)}`,
  })
  if (booking.description) params.set('details', booking.description)
  if (booking.location) params.set('location', booking.location)
  return `https://calendar.google.com/calendar/render?${params}`
}

export function feedUrl(origin: string, token: string) {
  return `${origin}/api/calendar/${token}.ics`
}

/** Opens Google Calendar's "add by URL" flow for a subscribable feed. */
export function googleCalendarSubscribeUrl(icsUrl: string) {
  const webcal = icsUrl.replace(/^https?:\/\//, 'webcal://')
  return `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`
}
