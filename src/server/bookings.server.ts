import { and, arrayContains, eq, gt, gte, lt, ne, or } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { bookings, rooms, users } from '../../db/schema.js'

/**
 * Returns an existing confirmed booking that overlaps the given range for this
 * room, or null. Two ranges overlap when each starts before the other ends.
 */
export async function findOverlappingBooking(
  roomId: number,
  startTime: string,
  endTime: string,
  excludeBookingId?: number,
) {
  const conditions = [
    eq(bookings.roomId, roomId),
    eq(bookings.status, 'confirmed'),
    lt(bookings.startTime, endTime),
    gt(bookings.endTime, startTime),
  ]
  if (excludeBookingId) {
    conditions.push(ne(bookings.id, excludeBookingId))
  }

  const [conflict] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(...conditions))

  return conflict ?? null
}

/**
 * Splits proposed occurrences into those that are free and those that clash
 * with an existing confirmed booking, using findOverlappingBooking for each.
 */
export async function partitionOccurrencesByConflict(
  roomId: number,
  occurrences: Array<{ startTime: string; endTime: string }>,
) {
  const results = await Promise.all(
    occurrences.map(async (occurrence) => ({
      occurrence,
      conflict: await findOverlappingBooking(
        roomId,
        occurrence.startTime,
        occurrence.endTime,
      ),
    })),
  )
  return {
    available: results.filter((r) => !r.conflict).map((r) => r.occurrence),
    conflicting: results.filter((r) => r.conflict).map((r) => r.occurrence),
  }
}

export async function listBookingsForRoomOnDay(
  roomId: number,
  dayStart: string,
  dayEnd: string,
) {
  return db
    .select({
      id: bookings.id,
      title: bookings.title,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      userId: bookings.userId,
      userName: users.name,
    })
    .from(bookings)
    .innerJoin(users, eq(bookings.userId, users.id))
    .where(
      and(
        eq(bookings.roomId, roomId),
        eq(bookings.status, 'confirmed'),
        lt(bookings.startTime, dayEnd),
        gt(bookings.endTime, dayStart),
      ),
    )
    .orderBy(bookings.startTime)
}

export async function listBookingsForUser(userId: number) {
  return db
    .select({
      id: bookings.id,
      title: bookings.title,
      description: bookings.description,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      status: bookings.status,
      attendees: bookings.attendees,
      seriesId: bookings.seriesId,
      recurrence: bookings.recurrence,
      roomId: bookings.roomId,
      roomName: rooms.name,
      roomLocation: rooms.location,
    })
    .from(bookings)
    .innerJoin(rooms, eq(bookings.roomId, rooms.id))
    .where(eq(bookings.userId, userId))
    .orderBy(bookings.startTime)
}

export async function getBookingById(id: number) {
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, id))
  return booking ?? null
}

export async function listAllConfirmedBookings() {
  return db
    .select({
      id: bookings.id,
      title: bookings.title,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      roomName: rooms.name,
      roomLocation: rooms.location,
      userName: users.name,
      userEmail: users.email,
    })
    .from(bookings)
    .innerJoin(rooms, eq(bookings.roomId, rooms.id))
    .innerJoin(users, eq(bookings.userId, users.id))
    .where(eq(bookings.status, 'confirmed'))
    .orderBy(bookings.startTime)
}

/** Cancels the given occurrence and every later confirmed one in its series. */
export async function cancelSeriesFrom(seriesId: string, fromStartTime: string) {
  return db
    .update(bookings)
    .set({ status: 'cancelled' })
    .where(
      and(
        eq(bookings.seriesId, seriesId),
        eq(bookings.status, 'confirmed'),
        gte(bookings.startTime, fromStartTime),
      ),
    )
    .returning({ id: bookings.id })
}

/** Confirmed bookings a user owns or is invited to, for their calendar feed. */
export async function listFeedBookingsForUser(userId: number, email: string) {
  return db
    .select({
      id: bookings.id,
      title: bookings.title,
      description: bookings.description,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      createdAt: bookings.createdAt,
      roomName: rooms.name,
      roomLocation: rooms.location,
      organizerName: users.name,
      organizerEmail: users.email,
    })
    .from(bookings)
    .innerJoin(rooms, eq(bookings.roomId, rooms.id))
    .innerJoin(users, eq(bookings.userId, users.id))
    .where(
      and(
        eq(bookings.status, 'confirmed'),
        or(
          eq(bookings.userId, userId),
          arrayContains(bookings.attendees, [email]),
        ),
      ),
    )
    .orderBy(bookings.startTime)
}
