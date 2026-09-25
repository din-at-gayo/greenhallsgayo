import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { bookings, users } from '../../db/schema.js'
import { getCurrentUser } from './auth.server.js'
import { getRoomById } from './rooms.server.js'
import { notify } from './notifications.server.js'
import {
  expandOccurrences,
  MAX_OCCURRENCES,
  RECURRENCE_FREQUENCIES,
} from '../lib/recurrence.js'
import {
  cancelSeriesFrom,
  findOverlappingBooking,
  getBookingById,
  listAllConfirmedBookings,
  listBookingsForRoomOnDay,
  listBookingsForUser,
  partitionOccurrencesByConflict,
} from './bookings.server.js'

async function requireUser() {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not authenticated')
  return user
}

const CONFLICT_MESSAGE =
  'This room is already booked for part of that time range.'

const BookingInputSchema = z
  .object({
    roomId: z.number().int(),
    startTime: z.string().min(1),
    endTime: z.string().min(1),
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    attendees: z.array(z.string().email()).max(50).default([]),
  })
  .refine((data) => new Date(data.startTime) < new Date(data.endTime), {
    message: 'End time must be after start time',
    path: ['endTime'],
  })

export const getRoomBookingsForDay = createServerFn({ method: 'GET' })
  .inputValidator(
    (data: { roomId: number; dayStart: string; dayEnd: string }) => data,
  )
  .handler(async ({ data }) => {
    return listBookingsForRoomOnDay(data.roomId, data.dayStart, data.dayEnd)
  })

export const getMyBookings = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await requireUser()
    return listBookingsForUser(user.id)
  },
)

export const getAllBookingsForAdmin = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await requireUser()
    if (user.role !== 'admin') throw new Error('Admin access required')
    return listAllConfirmedBookings()
  },
)

const CreateBookingSchema = BookingInputSchema.and(
  z.object({
    recurrence: z
      .object({
        frequency: z.enum(RECURRENCE_FREQUENCIES),
        count: z.number().int().min(2).max(MAX_OCCURRENCES),
      })
      .nullable()
      .default(null),
    // Set once the user has seen the conflicting dates and chosen to book the rest.
    skipConflicts: z.boolean().default(false),
  }),
)

export const createBooking = createServerFn({ method: 'POST' })
  .inputValidator(CreateBookingSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()

    const room = await getRoomById(data.roomId)
    if (!room || !room.isActive) {
      return { error: 'Room not found or inactive' } as const
    }

    const occurrences = expandOccurrences(
      data.startTime,
      data.endTime,
      data.recurrence?.frequency ?? null,
      data.recurrence?.count ?? 1,
    )
    const isSeries = occurrences.length > 1

    // A meeting longer than its repeat interval would double-book itself.
    for (let i = 1; i < occurrences.length; i++) {
      if (occurrences[i - 1].endTime > occurrences[i].startTime) {
        return {
          error: 'Each meeting must end before the next one in the series starts.',
        } as const
      }
    }

    // Server-side conflict check: never trust the client's time picker.
    const { available, conflicting } = await partitionOccurrencesByConflict(
      data.roomId,
      occurrences,
    )
    if (available.length === 0) {
      return {
        error: isSeries
          ? 'This room is already booked on every date in that series.'
          : CONFLICT_MESSAGE,
      } as const
    }
    if (conflicting.length > 0 && !data.skipConflicts) {
      return { conflicts: conflicting, availableCount: available.length } as const
    }

    const seriesId = isSeries ? randomUUID() : null
    const created = await db
      .insert(bookings)
      .values(
        available.map((occurrence) => ({
          roomId: data.roomId,
          userId: user.id,
          title: data.title,
          description: data.description ?? '',
          startTime: occurrence.startTime,
          endTime: occurrence.endTime,
          attendees: data.attendees,
          seriesId,
          recurrence: isSeries ? data.recurrence!.frequency : null,
        })),
      )
      .returning()
    const [booking] = created

    notify('booking_created', user.email, {
      room: room.name,
      title: booking.title,
      startTime: booking.startTime,
      endTime: booking.endTime,
      ...(isSeries && {
        recurrence: data.recurrence!.frequency,
        occurrences: created.map((b) => b.startTime),
        skipped: conflicting.map((o) => o.startTime),
      }),
    })
    for (const attendee of data.attendees) {
      notify('booking_invite', attendee, {
        room: room.name,
        title: booking.title,
        startTime: booking.startTime,
        ...(isSeries && { occurrences: created.map((b) => b.startTime) }),
      })
    }

    return {
      success: true,
      booking,
      createdCount: created.length,
      skipped: conflicting,
    } as const
  })

export const updateBooking = createServerFn({ method: 'POST' })
  .inputValidator(BookingInputSchema.and(z.object({ id: z.number().int() })))
  .handler(async ({ data }) => {
    const user = await requireUser()
    const existing = await getBookingById(data.id)

    if (!existing || existing.status !== 'confirmed') {
      return { error: 'Booking not found' } as const
    }
    if (existing.userId !== user.id && user.role !== 'admin') {
      return { error: 'You can only edit your own bookings' } as const
    }

    const room = await getRoomById(data.roomId)
    if (!room || !room.isActive) {
      return { error: 'Room not found or inactive' } as const
    }

    const conflict = await findOverlappingBooking(
      data.roomId,
      data.startTime,
      data.endTime,
      data.id,
    )
    if (conflict) {
      return { error: CONFLICT_MESSAGE } as const
    }

    const [booking] = await db
      .update(bookings)
      .set({
        roomId: data.roomId,
        title: data.title,
        description: data.description ?? '',
        startTime: data.startTime,
        endTime: data.endTime,
        attendees: data.attendees,
      })
      .where(eq(bookings.id, data.id))
      .returning()

    const [owner] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, existing.userId))
    if (owner) {
      notify('booking_updated', owner.email, {
        room: room.name,
        title: booking.title,
        startTime: booking.startTime,
      })
    }

    return { success: true, booking } as const
  })

export const cancelBooking = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      id: z.number().int(),
      // 'series' cancels this occurrence and all later ones in the same series.
      scope: z.enum(['single', 'series']).default('single'),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireUser()
    const existing = await getBookingById(data.id)

    if (!existing || existing.status !== 'confirmed') {
      return { error: 'Booking not found' } as const
    }
    if (existing.userId !== user.id && user.role !== 'admin') {
      return { error: 'You can only cancel your own bookings' } as const
    }

    const cancelSeries = data.scope === 'series' && existing.seriesId
    if (cancelSeries) {
      await cancelSeriesFrom(existing.seriesId!, existing.startTime)
    } else {
      await db
        .update(bookings)
        .set({ status: 'cancelled' })
        .where(eq(bookings.id, data.id))
    }

    const [owner] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, existing.userId))
    if (owner) {
      notify('booking_cancelled', owner.email, {
        title: existing.title,
        startTime: existing.startTime,
        ...(cancelSeries && { scope: 'this and following occurrences' }),
      })
    }

    return { success: true } as const
  })
