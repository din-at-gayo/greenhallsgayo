import { and, eq, gt, lt, ne } from 'drizzle-orm'
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
