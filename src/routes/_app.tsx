import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { getMe } from '../server/auth.functions.js'
import { Header } from '../components/Header.js'

export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const user = await getMe()
    if (!user) {
      throw redirect({ to: '/login' })
    }
    return { user }
  },
  component: AppLayout,
})

function AppLayout() {
  const { user } = Route.useRouteContext()

  return (
    <div className="min-h-screen bg-slate-50">
      <Header user={user} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <Outlet />
      </main>
    </div>
  )
}
