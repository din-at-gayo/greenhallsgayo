import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { Pencil, Plus, Power } from 'lucide-react'
import { getMe } from '../server/auth.functions.js'
import {
  createRoom,
  getAllRoomsForAdmin,
  setRoomActive,
  updateRoom,
} from '../server/rooms.functions.js'

export const Route = createFileRoute('/_app/admin/rooms')({
  beforeLoad: async () => {
    const user = await getMe()
    if (!user || user.role !== 'admin') {
      throw redirect({ to: '/rooms' })
    }
  },
  loader: async () => {
    const rooms = await getAllRoomsForAdmin()
    return { rooms }
  },
  component: AdminRooms,
})

type RoomRow = {
  id: number
  name: string
  location: string
  floor: string | null
  capacity: number
  equipment: Array<string>
  photoUrl: string | null
  isActive: boolean
}

const emptyForm = {
  name: '',
  location: '',
  floor: '',
  capacity: 4,
  equipment: '',
  photoUrl: '',
}

const fieldClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

function AdminRooms() {
  const { rooms } = Route.useLoaderData()
  const router = useRouter()
  const [editing, setEditing] = useState<RoomRow | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setError(null)
    setShowForm(true)
  }

  function openEdit(room: RoomRow) {
    setEditing(room)
    setForm({
      name: room.name,
      location: room.location,
      floor: room.floor ?? '',
      capacity: room.capacity,
      equipment: room.equipment.join(', '),
      photoUrl: room.photoUrl ?? '',
    })
    setError(null)
    setShowForm(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        name: form.name,
        location: form.location,
        floor: form.floor || undefined,
        capacity: Number(form.capacity),
        equipment: form.equipment
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        photoUrl: form.photoUrl || undefined,
      }
      if (editing) {
        await updateRoom({ data: { ...payload, id: editing.id } })
      } else {
        await createRoom({ data: payload })
      }
      setShowForm(false)
      router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleActive(room: RoomRow) {
    await setRoomActive({ data: { id: room.id, isActive: !room.isActive } })
    router.invalidate()
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Manage Rooms</h1>
          <p className="text-sm text-slate-500">
            Add, edit, or deactivate meeting rooms.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md px-4 py-2"
        >
          <Plus className="w-4 h-4" />
          Add room
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Location</th>
              <th className="px-4 py-2 font-medium">Capacity</th>
              <th className="px-4 py-2 font-medium">Equipment</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rooms.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  No rooms yet. Add your first room to get started.
                </td>
              </tr>
            )}
            {rooms.map((room) => (
              <tr key={room.id} className={room.isActive ? '' : 'opacity-50'}>
                <td className="px-4 py-2.5 font-medium text-slate-900">
                  {room.name}
                </td>
                <td className="px-4 py-2.5 text-slate-600">
                  {room.location}
                  {room.floor ? ` · ${room.floor}` : ''}
                </td>
                <td className="px-4 py-2.5 text-slate-600">{room.capacity}</td>
                <td className="px-4 py-2.5 text-slate-600">
                  {room.equipment.join(', ') || '—'}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`text-xs rounded px-2 py-0.5 ${room.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}
                  >
                    {room.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => openEdit(room)}
                      className="text-slate-500 hover:text-blue-600"
                      aria-label={`Edit ${room.name}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleActive(room)}
                      className="text-slate-500 hover:text-red-600"
                      aria-label={`${room.isActive ? 'Deactivate' : 'Activate'} ${room.name}`}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              {editing ? 'Edit room' : 'Add room'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Name
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={fieldClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Location
                  </label>
                  <input
                    required
                    value={form.location}
                    onChange={(e) =>
                      setForm({ ...form, location: e.target.value })
                    }
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Floor
                  </label>
                  <input
                    value={form.floor}
                    onChange={(e) => setForm({ ...form, floor: e.target.value })}
                    className={fieldClass}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Capacity
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={form.capacity}
                  onChange={(e) =>
                    setForm({ ...form, capacity: Number(e.target.value) })
                  }
                  className={fieldClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Equipment{' '}
                  <span className="text-slate-400 font-normal">
                    (comma separated)
                  </span>
                </label>
                <input
                  value={form.equipment}
                  onChange={(e) =>
                    setForm({ ...form, equipment: e.target.value })
                  }
                  placeholder="Projector, Whiteboard"
                  className={fieldClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Photo URL{' '}
                  <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  value={form.photoUrl}
                  onChange={(e) =>
                    setForm({ ...form, photoUrl: e.target.value })
                  }
                  className={fieldClass}
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 rounded-md border border-slate-300 text-slate-700 text-sm font-medium py-2 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium py-2"
                >
                  {submitting ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
