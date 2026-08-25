import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { cancelBooking, getMyBookings } from '../server/bookings.functions.js'
import { getRooms } from '../server/rooms.functions.js'
import { BookingFormModal } from '../components/BookingFormModal.js'
import { formatDateTime } from '../lib/time.js'

export const Route = createFileRoute('/_app/bookings')({
  loader: async () => {
    const [bookings, rooms] = await Promise.all([getMyBookings(), getRooms()])
    return { bookings, rooms }
  },
  component: MyBookings,
})

function MyBookings() {
  const { bookings, rooms } = Route.useLoaderData()
  const router = useRouter()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [cancellingId, setCancellingId] = useState<number | null>(null)

  const now = new Date()
  const upcoming = bookings.filter(
    (b) => b.status === 'confirmed' && new Date(b.endTime) >= now,
  )
  const past = bookings.filter(
    (b) => b.status !== 'confirmed' || new Date(b.endTime) < now,
  )

  const editingBooking = bookings.find((b) => b.id === editingId)

  async function handleCancel(id: number) {
    setCancellingId(id)
    try {
      await cancelBooking({ data: { id } })
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
                  <p className="font-medium text-slate-900">{b.title}</p>
                  <p className="text-sm text-slate-500">
                    {b.roomName} · {b.roomLocation}
                  </p>
                  <p className="text-sm text-slate-500">
                    {formatDateTime(b.startTime)} – {formatDateTime(b.endTime)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingId(b.id)}
                    className="text-sm font-medium text-brand-600 hover:text-brand-800 px-3 py-1.5 rounded-md border border-slate-200"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleCancel(b.id)}
                    disabled={cancellingId === b.id}
                    className="text-sm font-medium text-red-600 hover:text-red-800 px-3 py-1.5 rounded-md border border-slate-200 disabled:opacity-50"
                  >
                    {cancellingId === b.id ? 'Cancelling…' : 'Cancel'}
                  </button>
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
