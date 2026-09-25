import { createServerFn } from '@tanstack/react-start'
import { getCurrentUser } from './auth.server.js'
import {
  getOrCreateCalendarToken,
  resetCalendarToken,
} from './calendar.server.js'

async function requireUser() {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not authenticated')
  return user
}

export const getMyCalendarToken = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await requireUser()
    return getOrCreateCalendarToken(user.id)
  },
)

export const regenerateMyCalendarToken = createServerFn({
  method: 'POST',
}).handler(async () => {
  const user = await requireUser()
  return resetCalendarToken(user.id)
})
