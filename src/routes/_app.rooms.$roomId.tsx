import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowLeft, MapPin, Users } from 'lucide-react'
import { getRoom } from '../server/rooms.functions.js'
import { getRoomBookingsForDay } from '../server/bookings.functions.js'
import { BookingFormModal } from '../components/BookingFormModal.js'
import { formatTimeRange, todayValue } from '../lib/time.js'

export const Route = createFileRoute('/_app/rooms/$roomId')({
  loader: async ({ params }) => {
    const roomId = Number(params.roomId)
    const room = await getRoom({ data: { id: roomId } })
    if (!room) throw new Error('Room not found')

    const day = todayValue()
    const bookings = await getRoomBookingsForDay({
      data: { roomId, dayStart: `${day}T00:00`, dayEnd: `${day}T23:59` },
    })
    return { room, bookings, day }
  },
  errorComponent: ({ error }) => (
    <div className="text-sm text-red-600">{error.message}</div>
  ),
  component: RoomDetail,
})

function RoomDetail() {
  const { room, bookings, day } = Route.useLoaderData()
  const router = useRouter()
  const [selectedDay, setSelectedDay] = useState(day)
  const [dayBookings, setDayBookings] = useState(bookings)
  const [showBooking, setShowBooking] = useState(false)

  async function loadDay(nextDay: string) {
    setSelectedDay(nextDay)
    const result = await getRoomBookingsForDay({
      data: {
        roomId: room.id,
        dayStart: `${nextDay}T00:00`,
        dayEnd: `${nextDay}T23:59`,
      },
    })
    setDayBookings(result)
  }

  return (
    <div>
      <Link
        to="/rooms"
        className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to rooms
      </Link>

      <div className="bg-white border border-slate-200 rounded-lg p-5 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{room.name}</h1>
            <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
              <MapPin className="w-3.5 h-3.5" />
              {room.location}
              {room.floor ? ` · ${room.floor}` : ''}
            </p>
            <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
              <Users className="w-3.5 h-3.5" />
              Seats {room.capacity}
            </p>
            {room.equipment.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {room.equipment.map((eq) => (
                  <span
                    key={eq}
                    className="text-xs bg-slate-100 text-slate-600 rounded px-2 py-0.5"
                  >
                    {eq}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowBooking(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md px-4 py-2"
          >
            Book this room
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className="font-semibold text-slate-900">Availability</h2>
          <input
            type="date"
            value={selectedDay}
            onChange={(e) => loadDay(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        {dayBookings.length === 0 ? (
          <p className="text-sm text-slate-500">
            No bookings for this day — the room is free all day.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {dayBookings.map((b) => (
              <li key={b.id} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{b.title}</p>
                  <p className="text-xs text-slate-500">Booked by {b.userName}</p>
                </div>
                <span className="text-sm text-slate-600 whitespace-nowrap">
                  {formatTimeRange(b.startTime, b.endTime)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showBooking && (
        <BookingFormModal
          rooms={[room]}
          initial={{ roomId: room.id }}
          onClose={() => setShowBooking(false)}
          onSaved={() => {
            setShowBooking(false)
            loadDay(selectedDay)
            router.invalidate()
          }}
        />
      )}
    </div>
  )
}
