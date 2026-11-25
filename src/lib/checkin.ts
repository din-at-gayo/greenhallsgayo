import { normalizeWallClock, shiftWallClock } from './time.js'

/** Check-in opens this many minutes before a meeting starts. */
export const CHECK_IN_OPENS_BEFORE_MINUTES = 10
/** A booking nobody checked into is released this long after it starts. */
export const NO_SHOW_GRACE_MINUTES = 15

export type CheckInState =
  | 'not_open' // too early to check in
  | 'open' // check-in window is open
  | 'checked_in'
  | 'missed' // grace period over; release is due or done
  | 'inactive' // cancelled, released or otherwise not confirmed

/**
 * When an unclaimed booking gets released. A booking made after its start
 * time (e.g. grabbing a room that is free right now) gets the full grace period
 * from when it was made, so it is not released the moment it is created.
 */
export function releaseDeadline(startTime: string, createdAt: string) {
  const start = normalizeWallClock(startTime)
  const created = normalizeWallClock(createdAt)
  const anchor = created > start ? created : start
  return shiftWallClock(anchor, NO_SHOW_GRACE_MINUTES)
}

export function getCheckInState(
  booking: {
    status: string
    startTime: string
    endTime: string
    createdAt: string
    checkedInAt: string | null
  },
  now: string,
): CheckInState {
  if (booking.status !== 'confirmed') return 'inactive'
  if (booking.checkedInAt) return 'checked_in'
  const opens = shiftWallClock(booking.startTime, -CHECK_IN_OPENS_BEFORE_MINUTES)
  if (now < opens) return 'not_open'
  if (
    now >= releaseDeadline(booking.startTime, booking.createdAt) ||
    now >= normalizeWallClock(booking.endTime)
  ) {
    return 'missed'
  }
  return 'open'
}
