import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { getMe } from '../server/auth.functions.js'
import {
  cancelBooking,
  getAllBookingsForAdmin,
} from '../server/bookings.functions.js'
import { formatDateTime, formatTimeRange } from '../lib/time.js'

export const Route = createFileRoute('/_app/admin/bookings')({
  beforeLoad: async () => {
    const user = await getMe()
    if (!user || user.role !== 'admin') {
      throw redirect({ to: '/rooms' })
    }
  },
  loader: async () => {
    const bookings = await getAllBookingsForAdmin()
    return { bookings }
  },
  component: AdminBookings,
})

function AdminBookings() {
  const { bookings } = Route.useLoaderData()
  const router = useRouter()
  const [busyId, setBusyId] = useState<number | null>(null)

  async function handleCancel(id: number) {
    setBusyId(id)
    try {
      await cancelBooking({ data: { id } })
      router.invalidate()
    } finally {
      setBusyId(null)
    }
  }

  const now = new Date()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">All Bookings</h1>
        <p className="text-sm text-slate-500">
          Every confirmed booking across all rooms. Admins can cancel any of
          them.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">Room</th>
              <th className="px-4 py-2 font-medium">Meeting</th>
              <th className="px-4 py-2 font-medium">Booked by</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bookings.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  No confirmed bookings.
                </td>
              </tr>
            )}
            {bookings.map((booking) => {
              const isPast = new Date(booking.endTime) < now
              return (
                <tr key={booking.id} className={isPast ? 'opacity-60' : ''}>
                  <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">
                    <div>{formatDateTime(booking.startTime)}</div>
                    <div className="text-xs text-slate-500">
                      {formatTimeRange(booking.startTime, booking.endTime)}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    <div className="font-medium text-slate-900">
                      {booking.roomName}
                    </div>
                    <div className="text-xs text-slate-500">
                      {booking.roomLocation}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{booking.title}</td>
                  <td className="px-4 py-2.5 text-slate-700">
                    <div>{booking.userName}</div>
                    <div className="text-xs text-slate-500">
                      {booking.userEmail}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => handleCancel(booking.id)}
                      disabled={busyId === booking.id}
                      className="inline-flex items-center gap-1.5 text-red-600 hover:text-red-700 disabled:opacity-50 text-xs font-medium"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
