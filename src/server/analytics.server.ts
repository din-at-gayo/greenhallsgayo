import { and, gt, inArray, lt } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { bookings, rooms } from '../../db/schema.js'
import {
  normalizeWallClock,
  officeNow,
  shiftWallClock,
  wallClockToUtcDate,
} from '../lib/time.js'

// Utilization is measured against office hours: rooms sitting empty at 3am
// or on a Sunday should not drag the numbers down.
export const BUSINESS_DAYS = [1, 2, 3, 4, 5] // Mon–Fri (Date#getUTCDay)
export const BUSINESS_START_HOUR = 8
export const BUSINESS_END_HOUR = 18 // exclusive: the last slot is 17:00–18:00

const HOUR_MS = 60 * 60 * 1000

/**
 * Calls `onSlot` with the minutes of [start, end) that fall inside each
 * business-hour slot. Works on wall-clock strings, so there is no DST or
 * offset arithmetic involved.
 */
function forEachBusinessSlot(
  start: string,
  end: string,
  onSlot: (weekday: number, hour: number, minutes: number) => void,
) {
  const startMs = wallClockToUtcDate(start).getTime()
  const endMs = wallClockToUtcDate(end).getTime()
  if (endMs <= startMs) return

  let slot = startMs - (startMs % HOUR_MS)
  for (; slot < endMs; slot += HOUR_MS) {
    const date = new Date(slot)
    const weekday = date.getUTCDay()
    const hour = date.getUTCHours()
    if (
      !BUSINESS_DAYS.includes(weekday) ||
      hour < BUSINESS_START_HOUR ||
      hour >= BUSINESS_END_HOUR
    ) {
      continue
    }
    const overlap =
      (Math.min(endMs, slot + HOUR_MS) - Math.max(startMs, slot)) / 60000
    if (overlap > 0) onSlot(weekday, hour, overlap)
  }
}

function clip(value: string, min: string, max: string) {
  const v = normalizeWallClock(value)
  if (v < min) return min
  if (v > max) return max
  return v
}

type RoomStats = {
  roomId: number
  name: string
  location: string
  isActive: boolean
  capacityMinutes: number
  bookedMinutes: number // everything reserved, including no-shows
  occupiedMinutes: number // reserved minus released no-shows
  recoveredMinutes: number // released time handed back for rebooking
  meetings: number
  checkedIn: number
  noShows: number
}

export async function getUtilizationReport(days: number) {
  const now = officeNow()
  const rangeStart = `${shiftWallClock(now, -(days - 1) * 24 * 60).slice(0, 10)}T00:00`
  const rangeEnd = now

  const [allRooms, rows] = await Promise.all([
    db.select().from(rooms).orderBy(rooms.name),
    db
      .select({
        id: bookings.id,
        roomId: bookings.roomId,
        status: bookings.status,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
        checkedInAt: bookings.checkedInAt,
        releasedAt: bookings.releasedAt,
      })
      .from(bookings)
      .where(
        and(
          inArray(bookings.status, ['confirmed', 'released']),
          lt(bookings.startTime, rangeEnd),
          gt(bookings.endTime, rangeStart),
        ),
      ),
  ])

  // Capacity of one room over the range, overall and per weekday/hour slot.
  let capacityPerRoom = 0
  const slotCapacity = new Map<string, number>()
  forEachBusinessSlot(rangeStart, rangeEnd, (weekday, hour, minutes) => {
    capacityPerRoom += minutes
    const key = `${weekday}-${hour}`
    slotCapacity.set(key, (slotCapacity.get(key) ?? 0) + minutes)
  })

  const bookedRoomIds = new Set(rows.map((r) => r.roomId))
  const reportRooms = allRooms.filter(
    (room) => room.isActive || bookedRoomIds.has(room.id),
  )
  const stats = new Map<number, RoomStats>(
    reportRooms.map((room) => [
      room.id,
      {
        roomId: room.id,
        name: room.name,
        location: room.location,
        isActive: room.isActive,
        capacityMinutes: capacityPerRoom,
        bookedMinutes: 0,
        occupiedMinutes: 0,
        recoveredMinutes: 0,
        meetings: 0,
        checkedIn: 0,
        noShows: 0,
      },
    ]),
  )
  const slotOccupied = new Map<string, number>()

  for (const row of rows) {
    const room = stats.get(row.roomId)
    if (!room) continue
    const start = clip(row.startTime, rangeStart, rangeEnd)
    const end = clip(row.endTime, rangeStart, rangeEnd)

    if (normalizeWallClock(row.startTime) >= rangeStart) {
      room.meetings += 1
      if (row.checkedInAt) room.checkedIn += 1
      if (row.status === 'released') room.noShows += 1
    }

    forEachBusinessSlot(start, end, (_w, _h, minutes) => {
      room.bookedMinutes += minutes
    })

    if (row.status === 'released') {
      const releasedAt = clip(row.releasedAt ?? row.startTime, start, end)
      forEachBusinessSlot(releasedAt, end, (_w, _h, minutes) => {
        room.recoveredMinutes += minutes
      })
      continue
    }

    forEachBusinessSlot(start, end, (weekday, hour, minutes) => {
      room.occupiedMinutes += minutes
      const key = `${weekday}-${hour}`
      slotOccupied.set(key, (slotOccupied.get(key) ?? 0) + minutes)
    })
  }

  const roomStats = [...stats.values()]
  const roomCount = roomStats.length
  const sum = (pick: (r: RoomStats) => number) =>
    roomStats.reduce((total, r) => total + pick(r), 0)

  const heatmap = BUSINESS_DAYS.map((weekday) => ({
    weekday,
    hours: Array.from(
      { length: BUSINESS_END_HOUR - BUSINESS_START_HOUR },
      (_, i) => {
        const hour = BUSINESS_START_HOUR + i
        const key = `${weekday}-${hour}`
        const capacity = (slotCapacity.get(key) ?? 0) * roomCount
        return {
          hour,
          // null means the slot has not happened yet in this range.
          rate: capacity > 0 ? (slotOccupied.get(key) ?? 0) / capacity : null,
        }
      },
    ),
  }))

  return {
    days,
    rangeStart,
    rangeEnd,
    businessHours: { start: BUSINESS_START_HOUR, end: BUSINESS_END_HOUR },
    totals: {
      capacityMinutes: sum((r) => r.capacityMinutes),
      bookedMinutes: sum((r) => r.bookedMinutes),
      occupiedMinutes: sum((r) => r.occupiedMinutes),
      recoveredMinutes: sum((r) => r.recoveredMinutes),
      meetings: sum((r) => r.meetings),
      checkedIn: sum((r) => r.checkedIn),
      noShows: sum((r) => r.noShows),
    },
    rooms: roomStats.sort((a, b) => b.occupiedMinutes - a.occupiedMinutes),
    heatmap,
  }
}

export type UtilizationReport = Awaited<ReturnType<typeof getUtilizationReport>>
