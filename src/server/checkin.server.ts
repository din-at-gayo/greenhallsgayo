import { and, eq, gt, inArray, isNull, lte, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { bookings, rooms, users } from '../../db/schema.js'
import { NO_SHOW_GRACE_MINUTES } from '../lib/checkin.js'
import { officeNow, shiftWallClock } from '../lib/time.js'
import { notify } from './notifications.server.js'

// Only bookings that started within this window are auto-released. It stops
// the first run from sweeping up meetings that ended long before check-in
// existed, while still catching anything a delayed run missed.
const RELEASE_LOOKBACK_HOURS = 24

/**
 * Releases every confirmed booking nobody checked into once its grace period
 * is over, freeing the room for others. Idempotent and cheap, so it runs on a
 * schedule and also before any read or write that depends on room
 * availability, which keeps it accurate even between scheduled runs.
 *
 * `created_at` is written by Postgres `now()` in UTC. Accra is UTC+0 all year,
 * so it shares a clock with the office wall-clock booking times.
 */
export async function releaseNoShows() {
  const now = officeNow()
  const deadline = shiftWallClock(now, -NO_SHOW_GRACE_MINUTES)
  const lookback = shiftWallClock(now, -RELEASE_LOOKBACK_HOURS * 60)

  const released = await db
    .update(bookings)
    .set({ status: 'released', releasedAt: now })
    .where(
      and(
        eq(bookings.status, 'confirmed'),
        isNull(bookings.checkedInAt),
        lte(bookings.startTime, deadline),
        gt(bookings.startTime, lookback),
        lte(bookings.createdAt, sql`${deadline}::timestamp`),
      ),
    )
    .returning({
      id: bookings.id,
      title: bookings.title,
      startTime: bookings.startTime,
      userId: bookings.userId,
      roomId: bookings.roomId,
    })

  if (released.length > 0) {
    const details = await db
      .select({ id: bookings.id, email: users.email, room: rooms.name })
      .from(bookings)
      .innerJoin(users, eq(bookings.userId, users.id))
      .innerJoin(rooms, eq(bookings.roomId, rooms.id))
      .where(
        inArray(
          bookings.id,
          released.map((b) => b.id),
        ),
      )
    const byId = new Map(details.map((d) => [d.id, d]))
    for (const booking of released) {
      const info = byId.get(booking.id)
      if (!info) continue
      notify('booking_released', info.email, {
        room: info.room,
        title: booking.title,
        startTime: booking.startTime,
        reason: `No one checked in within ${NO_SHOW_GRACE_MINUTES} minutes of the start time.`,
      })
    }
  }

  return released
}
