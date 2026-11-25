import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { bookings, users } from '../../db/schema.js'
import { getCurrentUser } from './auth.server.js'
import { getRoomById } from './rooms.server.js'
import { notify } from './notifications.server.js'
import { releaseNoShows } from './checkin.server.js'
import {
  CHECK_IN_OPENS_BEFORE_MINUTES,
  getCheckInState,
  NO_SHOW_GRACE_MINUTES,
} from '../lib/checkin.js'
import {
  normalizeWallClock,
  officeNow,
  utcDateToWallClock,
} from '../lib/time.js'
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
    await releaseNoShows()
    return listBookingsForRoomOnDay(data.roomId, data.dayStart, data.dayEnd)
  })

export const getMyBookings = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await requireUser()
    await releaseNoShows()
    return listBookingsForUser(user.id)
  },
)

export const getAllBookingsForAdmin = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await requireUser()
    if (user.role !== 'admin') throw new Error('Admin access required')
    await releaseNoShows()
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

    // Free up no-show slots first so they can be rebooked straight away.
    await releaseNoShows()

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

    await releaseNoShows()
    const conflict = await findOverlappingBooking(
      data.roomId,
      data.startTime,
      data.endTime,
      data.id,
    )
    if (conflict) {
      return { error: CONFLICT_MESSAGE } as const
    }

    const slotChanged =
      normalizeWallClock(existing.startTime) !==
        normalizeWallClock(data.startTime) || existing.roomId !== data.roomId
    const [booking] = await db
      .update(bookings)
      .set({
        roomId: data.roomId,
        title: data.title,
        description: data.description ?? '',
        startTime: data.startTime,
        endTime: data.endTime,
        attendees: data.attendees,
        // A check-in belongs to the original slot; moving or switching rooms
        // means checking in again at the new time.
        checkedInAt: slotChanged ? null : existing.checkedInAt,
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

export const checkInBooking = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    const user = await requireUser()
    // Release anything overdue first, so a late check-in cannot reclaim a
    // slot that should already have been freed.
    await releaseNoShows()
    const existing = await getBookingById(data.id)

    if (!existing) return { error: 'Booking not found' } as const
    const isOwner = existing.userId === user.id
    const isAttendee = existing.attendees.includes(user.email)
    if (!isOwner && !isAttendee && user.role !== 'admin') {
      return {
        error: 'Only the organizer or an invited attendee can check in.',
      } as const
    }
    if (existing.status === 'released') {
      return {
        error: `This booking was released because no one checked in within ${NO_SHOW_GRACE_MINUTES} minutes of the start.`,
      } as const
    }

    const now = officeNow()
    const state = getCheckInState(
      { ...existing, createdAt: utcDateToWallClock(existing.createdAt) },
      now,
    )
    switch (state) {
      case 'inactive':
        return { error: 'This booking is no longer active.' } as const
      case 'checked_in':
        return { success: true, checkedInAt: existing.checkedInAt! } as const
      case 'not_open':
        return {
          error: `Check-in opens ${CHECK_IN_OPENS_BEFORE_MINUTES} minutes before the meeting starts.`,
        } as const
      case 'missed':
        return { error: 'The check-in window for this meeting has closed.' } as const
    }

    // Guard on status so a concurrent release cannot be overwritten.
    const [updated] = await db
      .update(bookings)
      .set({ checkedInAt: now })
      .where(and(eq(bookings.id, data.id), eq(bookings.status, 'confirmed')))
      .returning({ checkedInAt: bookings.checkedInAt })
    if (!updated) return { error: 'This booking is no longer active.' } as const

    return { success: true, checkedInAt: updated.checkedInAt! } as const
  })
