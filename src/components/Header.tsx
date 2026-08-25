import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { CalendarClock, DoorOpen, LogOut, Shield } from 'lucide-react'
import { logout } from '../server/auth.functions.js'
import type { SessionUser } from '../server/auth.server.js'

const linkClass =
  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 [&.active]:bg-brand-50 [&.active]:text-brand-700'

export function Header({ user }: { user: SessionUser }) {
  const navigate = useNavigate()
  const router = useRouter()

  async function handleLogout() {
    await logout()
    await router.invalidate()
    navigate({ to: '/login' })
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link
            to="/rooms"
            className="font-semibold text-slate-900 flex items-center gap-2"
          >
            <DoorOpen className="w-5 h-5 text-brand-600" />
            RoomBook
          </Link>
          <nav className="hidden sm:flex items-center gap-1">
            <Link to="/rooms" className={linkClass}>
              Rooms
            </Link>
            <Link to="/bookings" className={linkClass}>
              <CalendarClock className="w-4 h-4" />
              My Bookings
            </Link>
            {user.role === 'admin' && (
              <>
                <Link to="/admin/rooms" className={linkClass}>
                  <Shield className="w-4 h-4" />
                  Rooms Admin
                </Link>
                <Link to="/admin/bookings" className={linkClass}>
                  All Bookings
                </Link>
              </>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500 hidden sm:inline">
            {user.name}
          </span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </div>
      </div>
    </header>
  )
}
