import { createFileRoute, redirect } from '@tanstack/react-router'
import { getMe } from '../server/auth.functions.js'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const user = await getMe()
    throw redirect({ to: user ? '/rooms' : '/login' })
  },
})
