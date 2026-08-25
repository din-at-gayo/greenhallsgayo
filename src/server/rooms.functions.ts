import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { rooms } from '../../db/schema.js'
import { getCurrentUser } from './auth.server.js'
import { listActiveRooms, listAllRooms, getRoomById } from './rooms.server.js'

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    throw new Error('Admin access required')
  }
  return user
}

export const getRooms = createServerFn({ method: 'GET' }).handler(async () => {
  return listActiveRooms()
})

export const getAllRoomsForAdmin = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireAdmin()
    return listAllRooms()
  },
)

export const getRoom = createServerFn({ method: 'GET' })
  .inputValidator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    return getRoomById(data.id)
  })

const RoomSchema = z.object({
  name: z.string().min(1).max(150),
  location: z.string().min(1).max(150),
  floor: z.string().max(50).optional(),
  capacity: z.number().int().min(1).max(1000),
  equipment: z.array(z.string().min(1).max(50)).max(20).default([]),
  photoUrl: z.string().max(500).optional(),
})

export const createRoom = createServerFn({ method: 'POST' })
  .inputValidator(RoomSchema)
  .handler(async ({ data }) => {
    await requireAdmin()
    const [room] = await db
      .insert(rooms)
      .values({
        name: data.name,
        location: data.location,
        floor: data.floor || null,
        capacity: data.capacity,
        equipment: data.equipment,
        photoUrl: data.photoUrl || null,
      })
      .returning()
    return room
  })

export const updateRoom = createServerFn({ method: 'POST' })
  .inputValidator(RoomSchema.extend({ id: z.number().int() }))
  .handler(async ({ data }) => {
    await requireAdmin()
    const [room] = await db
      .update(rooms)
      .set({
        name: data.name,
        location: data.location,
        floor: data.floor || null,
        capacity: data.capacity,
        equipment: data.equipment,
        photoUrl: data.photoUrl || null,
      })
      .where(eq(rooms.id, data.id))
      .returning()
    return room
  })

export const setRoomActive = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.number().int(), isActive: z.boolean() }))
  .handler(async ({ data }) => {
    await requireAdmin()
    const [room] = await db
      .update(rooms)
      .set({ isActive: data.isActive })
      .where(eq(rooms.id, data.id))
      .returning()
    return room
  })
