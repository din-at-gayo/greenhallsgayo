import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { users } from '../../db/schema.js'
import {
  createUserSession,
  destroyUserSession,
  getCurrentUser,
  hashPassword,
  verifyPassword,
} from './auth.server.js'

export const getMe = createServerFn({ method: 'GET' }).handler(async () => {
  return getCurrentUser()
})

export const login = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email.toLowerCase()))

    if (!user || !verifyPassword(data.password, user.passwordHash)) {
      return { error: 'Invalid email or password' } as const
    }

    await createUserSession(user.id)
    return { success: true } as const
  })

export const signup = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      name: z.string().min(1).max(100),
      email: z.string().email(),
      password: z.string().min(8).max(200),
    }),
  )
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase()
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))

    if (existing) {
      return { error: 'An account with that email already exists' } as const
    }

    const [user] = await db
      .insert(users)
      .values({
        name: data.name,
        email,
        passwordHash: hashPassword(data.password),
        role: 'employee',
      })
      .returning()

    await createUserSession(user.id)
    return { success: true } as const
  })

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  await destroyUserSession()
  return { success: true } as const
})
