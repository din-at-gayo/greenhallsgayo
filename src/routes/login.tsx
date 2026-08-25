import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { DoorOpen } from 'lucide-react'
import { getMe, login } from '../server/auth.functions.js'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    const user = await getMe()
    if (user) throw redirect({ to: '/rooms' })
  },
  component: LoginPage,
})

const fieldClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('employee@example.com')
  const [password, setPassword] = useState('password123')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const result = await login({ data: { email, password } })
      if ('error' in result) {
        setError(result.error)
        return
      }
      navigate({ to: '/rooms' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-6">
          <DoorOpen className="w-7 h-7 text-blue-600" />
          <span className="text-xl font-semibold text-slate-900">RoomBook</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h1 className="text-lg font-semibold text-slate-900 mb-1">Sign in</h1>
          <p className="text-sm text-slate-500 mb-5">
            Book a meeting room for your team.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={fieldClass}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-md py-2 transition"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <p className="text-sm text-slate-500 mt-4 text-center">
            No account?{' '}
            <Link to="/signup" className="text-blue-600 font-medium">
              Sign up
            </Link>
          </p>
          <div className="mt-5 pt-4 border-t border-slate-100 text-xs text-slate-400 space-y-0.5">
            <p>Demo admin: admin@example.com / password123</p>
            <p>Demo employee: employee@example.com / password123</p>
          </div>
        </div>
      </div>
    </div>
  )
}
