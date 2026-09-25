import { useState, type FormEvent } from 'react'
import { AlertTriangle, Repeat, X } from 'lucide-react'
import { createBooking, updateBooking } from '../server/bookings.functions.js'
import {
  toDateTimeLocalValue,
  addMinutes,
  roundToNext15,
  formatDateTime,
} from '../lib/time.js'
import {
  expandOccurrences,
  MAX_OCCURRENCES,
  RECURRENCE_FREQUENCIES,
  RECURRENCE_LABELS,
  type Occurrence,
  type RecurrenceFrequency,
} from '../lib/recurrence.js'

type RoomOption = { id: number; name: string; location: string }

export type BookingFormValues = {
  id?: number
  roomId: number
  title: string
  description: string
  startTime: string
  endTime: string
  attendees: string
}

const fieldClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

export function BookingFormModal({
  rooms,
  initial,
  onClose,
  onSaved,
}: {
  rooms: Array<RoomOption>
  initial?: Partial<BookingFormValues>
  onClose: () => void
  onSaved: () => void
}) {
  const now = roundToNext15(new Date())
  const [roomId, setRoomId] = useState(initial?.roomId ?? rooms[0]?.id)
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [startTime, setStartTime] = useState(
    initial?.startTime ?? toDateTimeLocalValue(now),
  )
  const [endTime, setEndTime] = useState(
    initial?.endTime ?? toDateTimeLocalValue(addMinutes(now, 30)),
  )
  const [attendees, setAttendees] = useState(initial?.attendees ?? '')
  const [frequency, setFrequency] = useState<RecurrenceFrequency | ''>('')
  const [count, setCount] = useState(4)
  const [conflicts, setConflicts] = useState<{
    dates: Array<Occurrence>
    availableCount: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const isEditing = Boolean(initial?.id)
  const occurrences =
    frequency && startTime && endTime
      ? expandOccurrences(startTime, endTime, frequency, count)
      : []

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await save(false)
  }

  async function save(skipConflicts: boolean) {
    if (!roomId) {
      setError('Choose a room')
      return
    }
    setSubmitting(true)
    setError(null)

    const attendeeList = attendees
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean)

    try {
      const payload = {
        roomId,
        title,
        description,
        startTime,
        endTime,
        attendees: attendeeList,
      }
      const result = initial?.id
        ? await updateBooking({ data: { ...payload, id: initial.id } })
        : await createBooking({
            data: {
              ...payload,
              recurrence: frequency ? { frequency, count } : null,
              skipConflicts,
            },
          })

      if ('error' in result) {
        setConflicts(null)
        setError(result.error)
        return
      }
      if ('conflicts' in result) {
        setConflicts({
          dates: result.conflicts,
          availableCount: result.availableCount,
        })
        return
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          {conflicts
            ? 'Some dates are unavailable'
            : isEditing
              ? 'Edit booking'
              : 'Book a room'}
        </h2>
        {conflicts ? (
          <div className="space-y-4">
            <div className="flex gap-3 rounded-md bg-amber-50 border border-amber-200 p-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-900">
                <p className="font-medium">
                  {conflicts.dates.length} of{' '}
                  {conflicts.dates.length + conflicts.availableCount} dates are
                  already booked
                </p>
                <p className="mt-1">
                  The room is taken for part of these times:
                </p>
                <ul className="mt-2 space-y-1 list-disc pl-4">
                  {conflicts.dates.map((d) => (
                    <li key={d.startTime}>{formatDateTime(d.startTime)}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="text-sm text-slate-600">
              You can book the {conflicts.availableCount} free{' '}
              {conflicts.availableCount === 1 ? 'date' : 'dates'} and skip the
              conflicts, or go back and pick different dates.
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setConflicts(null)
                  setError(null)
                }}
                className="flex-1 rounded-md border border-slate-300 text-slate-700 text-sm font-medium py-2 hover:bg-slate-50"
              >
                Change dates
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => save(true)}
                className="flex-1 rounded-md bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium py-2"
              >
                {submitting
                  ? 'Booking…'
                  : `Book ${conflicts.availableCount} free ${conflicts.availableCount === 1 ? 'date' : 'dates'}`}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Room
              </label>
              <select
                value={roomId}
                onChange={(e) => setRoomId(Number(e.target.value))}
                className={fieldClass}
              >
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name} — {room.location}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Meeting title
              </label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={fieldClass}
                placeholder="Weekly sync"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Start
                </label>
                <input
                  type="datetime-local"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  End
                </label>
                <input
                  type="datetime-local"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className={fieldClass}
                />
              </div>
            </div>
            {!isEditing && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Repeat
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={frequency}
                    onChange={(e) =>
                      setFrequency(e.target.value as RecurrenceFrequency | '')
                    }
                    className={fieldClass}
                  >
                    <option value="">Does not repeat</option>
                    {RECURRENCE_FREQUENCIES.map((f) => (
                      <option key={f} value={f}>
                        {RECURRENCE_LABELS[f]}
                      </option>
                    ))}
                  </select>
                  {frequency && (
                    <select
                      value={count}
                      onChange={(e) => setCount(Number(e.target.value))}
                      className={fieldClass}
                      aria-label="Number of occurrences"
                    >
                      {Array.from(
                        { length: MAX_OCCURRENCES - 1 },
                        (_, i) => i + 2,
                      ).map((n) => (
                        <option key={n} value={n}>
                          {n} times
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {occurrences.length > 1 && (
                  <ul className="mt-2 text-xs text-slate-500 space-y-0.5">
                    {occurrences.map((o) => (
                      <li key={o.startTime} className="flex items-center gap-1.5">
                        <Repeat className="w-3 h-3" />
                        {formatDateTime(o.startTime)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Description{' '}
                <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Attendees{' '}
                <span className="text-slate-400 font-normal">
                  (optional, comma separated emails)
                </span>
              </label>
              <input
                value={attendees}
                onChange={(e) => setAttendees(e.target.value)}
                placeholder="jane@company.com, sam@company.com"
                className={fieldClass}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-md border border-slate-300 text-slate-700 text-sm font-medium py-2 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-md bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium py-2"
              >
                {submitting
                  ? 'Saving…'
                  : isEditing
                    ? 'Save changes'
                    : occurrences.length > 1
                      ? `Book ${occurrences.length} meetings`
                      : 'Book room'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
