import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { rooms } from '../../db/schema.js'

export async function listActiveRooms() {
  return db
    .select()
    .from(rooms)
    .where(eq(rooms.isActive, true))
    .orderBy(rooms.name)
}

export async function listAllRooms() {
  return db.select().from(rooms).orderBy(rooms.name)
}

export async function getRoomById(id: number) {
  const [room] = await db.select().from(rooms).where(eq(rooms.id, id))
  return room ?? null
}
