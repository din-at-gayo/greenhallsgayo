import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { users } from '../../db/schema.js'
import { toCalendarStamp } from '../lib/calendar.js'
import { listFeedBookingsForUser } from './bookings.server.js'

function newToken() {
  return randomBytes(24).toString('base64url')
}

export async function getOrCreateCalendarToken(userId: number) {
  const [user] = await db
    .select({ calendarToken: users.calendarToken })
    .from(users)
    .where(eq(users.id, userId))
  if (user?.calendarToken) return user.calendarToken
  return resetCalendarToken(userId)
}

/** Issues a fresh token, invalidating any previously shared feed URL. */
export async function resetCalendarToken(userId: number) {
  const token = newToken()
  await db
    .update(users)
    .set({ calendarToken: token })
    .where(eq(users.id, userId))
  return token
}

export async function findUserByCalendarToken(token: string) {
  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.calendarToken, token))
  return user ?? null
}

// RFC 5545 text escaping and 75-octet line folding.
function escapeText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function fold(line: string) {
  const bytes = Buffer.from(line, 'utf8')
  if (bytes.length <= 75) return line
  const parts: Array<string> = []
  let current = ''
  for (const char of line) {
    const limit = parts.length === 0 ? 75 : 74
    if (Buffer.byteLength(current + char, 'utf8') > limit) {
      parts.push(current)
      current = char
    } else {
      current += char
    }
  }
  parts.push(current)
  return parts.join('\r\n ')
}

function utcStamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

export async function buildCalendarFeed(
  user: { id: number; name: string; email: string },
  host: string,
) {
  const bookings = await listFeedBookingsForUser(user.id, user.email)
  const now = utcStamp(new Date())

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RoomBook//Room Bookings//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(`RoomBook — ${user.name}`)}`,
    'X-PUBLISHED-TTL:PT1H',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
  ]
  for (const b of bookings) {
    const description = [
      b.description,
      `Booked by ${b.organizerName} (${b.organizerEmail})`,
    ]
      .filter(Boolean)
      .join('\n\n')
    lines.push(
      'BEGIN:VEVENT',
      `UID:booking-${b.id}@${host}`,
      `DTSTAMP:${now}`,
      `CREATED:${utcStamp(b.createdAt)}`,
      // Floating times: rendered in the subscriber's calendar time zone.
      `DTSTART:${toCalendarStamp(b.startTime)}`,
      `DTEND:${toCalendarStamp(b.endTime)}`,
      `SUMMARY:${escapeText(b.title)}`,
      `LOCATION:${escapeText(`${b.roomName}, ${b.roomLocation}`)}`,
      `DESCRIPTION:${escapeText(description)}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')

  return lines.map(fold).join('\r\n') + '\r\n'
}
