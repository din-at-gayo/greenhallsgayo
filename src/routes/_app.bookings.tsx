import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { CalendarPlus, Repeat } from 'lucide-react'
import { cancelBooking, getMyBookings } from '../server/bookings.functions.js'
import { getRooms } from '../server/rooms.functions.js'
import { getMyCalendarToken } from '../server/calendar.functions.js'
import { BookingFormModal } from '../components/BookingFormModal.js'
import { CalendarSyncPanel } from '../components/CalendarSyncPanel.js'
import { formatDateTime } from '../lib/time.js'
import { googleCalendarEventUrl } from '../lib/calendar.js'
import {
  RECURRENCE_LABELS,
  type RecurrenceFrequency,
} from '../lib/recurrence.js'

export const Route = createFileRoute('/_app/bookings')({
  loader: async () => {
    const [bookings, rooms, calendarToken] = await Promise.all([
      getMyBookings(),
      getRooms(),
      getMyCalendarToken(),
    ])
    return { bookings, rooms, calendarToken }
  },
  component: MyBookings,
})

function MyBookings() {
  const { bookings, rooms, calendarToken } = Route.useLoaderData()
  const router = useRouter()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [cancellingId, setCancellingId] = useState<number | null>(null)
  const [seriesPromptId, setSeriesPromptId] = useState<number | null>(null)

  const now = new Date()
  const upcoming = bookings.filter(
    (b) => b.status === 'confirmed' && new Date(b.endTime) >= now,
  )
  const past = bookings.filter(
    (b) => b.status !== 'confirmed' || new Date(b.endTime) < now,
  )

  const editingBooking = bookings.find((b) => b.id === editingId)

  async function handleCancel(id: number, scope: 'single' | 'series') {
    setSeriesPromptId(null)
    setCancellingId(id)
    try {
      await cancelBooking({ data: { id, scope } })
      router.invalidate()
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 mb-1">My Bookings</h1>
      <p className="text-sm text-slate-500 mb-6">
        View, edit, or cancel your upcoming meetings.
      </p>

      <CalendarSyncPanel token={calendarToken} />

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
          Upcoming
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-slate-500">No upcoming bookings.</p>
        ) : (
          <div className="space-y-3">
            {upcoming.map((b) => (
              <div
                key={b.id}
                className="bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-between flex-wrap gap-3"
              >
                <div>
                  <p className="font-medium text-slate-900 flex items-center gap-2">
                    {b.title}
                    {b.recurrence && (
                      <span className="inline-flex items-center gap-1 text-xs font-normal bg-brand-50 text-brand-700 rounded px-1.5 py-0.5">
                        <Repeat className="w-3 h-3" />
                        {RECURRENCE_LABELS[b.recurrence as RecurrenceFrequency]}
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-slate-500">
                    {b.roomName} · {b.roomLocation}
                  </p>
                  <p className="text-sm text-slate-500">
                    {formatDateTime(b.startTime)} – {formatDateTime(b.endTime)}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <a
                    href={googleCalendarEventUrl({
                      title: b.title,
                      description: b.description,
                      startTime: b.startTime,
                      endTime: b.endTime,
                      location: `${b.roomName}, ${b.roomLocation}`,
                    })}
                    target="_blank"
                    rel="noreferrer"
                    title="Add to Google Calendar"
                    aria-label="Add to Google Calendar"
                    className="text-slate-500 hover:text-brand-700 px-2 py-1.5 rounded-md border border-slate-200 flex items-center"
                  >
                    <CalendarPlus className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => setEditingId(b.id)}
                    className="text-sm font-medium text-brand-600 hover:text-brand-800 px-3 py-1.5 rounded-md border border-slate-200"
                  >
                    Edit
                  </button>
                  {seriesPromptId === b.id ? (
                    <>
                      <button
                        onClick={() => handleCancel(b.id, 'single')}
                        className="text-sm font-medium text-red-600 hover:text-red-800 px-3 py-1.5 rounded-md border border-red-200"
                      >
                        This meeting
                      </button>
                      <button
                        onClick={() => handleCancel(b.id, 'series')}
                        className="text-sm font-medium text-red-600 hover:text-red-800 px-3 py-1.5 rounded-md border border-red-200"
                      >
                        This &amp; following
                      </button>
                      <button
                        onClick={() => setSeriesPromptId(null)}
                        className="text-sm text-slate-500 hover:text-slate-800 px-2 py-1.5"
                      >
                        Keep
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() =>
                        b.seriesId
                          ? setSeriesPromptId(b.id)
                          : handleCancel(b.id, 'single')
                      }
                      disabled={cancellingId === b.id}
                      className="text-sm font-medium text-red-600 hover:text-red-800 px-3 py-1.5 rounded-md border border-slate-200 disabled:opacity-50"
                    >
                      {cancellingId === b.id ? 'Cancelling…' : 'Cancel'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
          Past &amp; Cancelled
        </h2>
        {past.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing here yet.</p>
        ) : (
          <div className="space-y-3">
            {past.map((b) => (
              <div
                key={b.id}
                className="bg-white border border-slate-200 rounded-lg p-4 opacity-70 flex items-center justify-between flex-wrap gap-3"
              >
                <div>
                  <p className="font-medium text-slate-900">{b.title}</p>
                  <p className="text-sm text-slate-500">
                    {b.roomName} · {formatDateTime(b.startTime)}
                  </p>
                </div>
                <span className="text-xs uppercase tracking-wide text-slate-400">
                  {b.status === 'cancelled' ? 'Cancelled' : 'Past'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {editingBooking && (
        <BookingFormModal
          rooms={rooms}
          initial={{
            id: editingBooking.id,
            roomId: editingBooking.roomId,
            title: editingBooking.title,
            description: editingBooking.description ?? '',
            startTime: editingBooking.startTime.slice(0, 16),
            endTime: editingBooking.endTime.slice(0, 16),
            attendees: editingBooking.attendees.join(', '),
          }}
          onClose={() => setEditingId(null)}
          onSaved={() => {
            setEditingId(null)
            router.invalidate()
          }}
        />
      )}
    </div>
  )
}
