import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { MapPin, Users, Zap } from 'lucide-react'
import { getRooms } from '../server/rooms.functions.js'
import { BookingFormModal } from '../components/BookingFormModal.js'

export const Route = createFileRoute('/_app/rooms/')({
  loader: async () => {
    const rooms = await getRooms()
    return { rooms }
  },
  component: RoomsIndex,
})

const fieldClass =
  'rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

function RoomsIndex() {
  const { rooms } = Route.useLoaderData()
  const router = useRouter()

  const [search, setSearch] = useState('')
  const [minCapacity, setMinCapacity] = useState('')
  const [equipmentFilter, setEquipmentFilter] = useState('')
  const [quickBookRoomId, setQuickBookRoomId] = useState<number | null>(null)

  const allEquipment = useMemo(() => {
    const set = new Set<string>()
    rooms.forEach((r) => r.equipment.forEach((e) => set.add(e)))
    return Array.from(set).sort()
  }, [rooms])

  const filteredRooms = rooms.filter((room) => {
    const term = search.toLowerCase()
    if (
      term &&
      !room.name.toLowerCase().includes(term) &&
      !room.location.toLowerCase().includes(term)
    ) {
      return false
    }
    if (minCapacity && room.capacity < Number(minCapacity)) return false
    if (equipmentFilter && !room.equipment.includes(equipmentFilter)) return false
    return true
  })

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Rooms</h1>
          <p className="text-sm text-slate-500">
            Browse rooms and book a time slot, or quick-book for right now.
          </p>
        </div>
        <button
          onClick={() => setQuickBookRoomId(rooms[0]?.id ?? null)}
          disabled={rooms.length === 0}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md px-4 py-2"
        >
          <Zap className="w-4 h-4" />
          Book a room now
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6 flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or location…"
          className={`flex-1 min-w-[180px] ${fieldClass}`}
        />
        <input
          type="number"
          min={1}
          value={minCapacity}
          onChange={(e) => setMinCapacity(e.target.value)}
          placeholder="Min capacity"
          className={`w-36 ${fieldClass}`}
        />
        <select
          value={equipmentFilter}
          onChange={(e) => setEquipmentFilter(e.target.value)}
          className={fieldClass}
        >
          <option value="">Any equipment</option>
          {allEquipment.map((eq) => (
            <option key={eq} value={eq}>
              {eq}
            </option>
          ))}
        </select>
      </div>

      {filteredRooms.length === 0 && (
        <p className="text-sm text-slate-500">
          {rooms.length === 0
            ? 'No rooms yet. An admin can add rooms from the Rooms Admin page.'
            : 'No rooms match your filters.'}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRooms.map((room) => (
          <Link
            key={room.id}
            to="/rooms/$roomId"
            params={{ roomId: String(room.id) }}
            className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md hover:border-blue-200 transition block"
          >
            {room.photoUrl && (
              <img
                src={room.photoUrl}
                alt={room.name}
                className="w-full h-32 object-cover rounded-md mb-3"
              />
            )}
            <h3 className="font-semibold text-slate-900">{room.name}</h3>
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
          </Link>
        ))}
      </div>

      {quickBookRoomId !== null && (
        <BookingFormModal
          rooms={rooms}
          initial={{ roomId: quickBookRoomId }}
          onClose={() => setQuickBookRoomId(null)}
          onSaved={() => {
            setQuickBookRoomId(null)
            router.invalidate()
          }}
        />
      )}
    </div>
  )
}
