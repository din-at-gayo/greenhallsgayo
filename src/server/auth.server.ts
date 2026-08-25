import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto'
import { useSession } from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { users } from '../../db/schema.js'

const SESSION_PASSWORD =
  process.env.SESSION_SECRET ??
  'dev-only-insecure-session-secret-change-me-32chars'

export type SessionUser = {
  id: number
  name: string
  email: string
  role: string
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const hashBuffer = Buffer.from(hash, 'hex')
  const candidate = scryptSync(password, salt, 64)
  if (candidate.length !== hashBuffer.length) return false
  return timingSafeEqual(candidate, hashBuffer)
}

function getAppSession() {
  return useSession<{ userId: number }>({
    password: SESSION_PASSWORD,
    name: 'room_booking_session',
    maxAge: 60 * 60 * 24 * 14,
  })
}

export async function createUserSession(userId: number) {
  const session = await getAppSession()
  await session.update({ userId })
}

export async function destroyUserSession() {
  const session = await getAppSession()
  await session.clear()
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getAppSession()
  const userId = session.data.userId
  if (!userId) return null

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, userId))

  return user ?? null
}
