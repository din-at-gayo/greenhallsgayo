import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { createBooking, updateBooking } from '../server/bookings.functions.js'
import { toDateTimeLocalValue, addMinutes, roundToNext15 } from '../lib/time.js'

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
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
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
        : await createBooking({ data: payload })

      if ('error' in result) {
        setError(result.error)
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
          {initial?.id ? 'Edit booking' : 'Book a room'}
        </h2>
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
              {submitting ? 'Saving…' : initial?.id ? 'Save changes' : 'Book room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
