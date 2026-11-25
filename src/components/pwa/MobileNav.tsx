import { Link } from '@tanstack/react-router'
import { BarChart3, CalendarClock, DoorOpen, ListChecks, Shield } from 'lucide-react'
import type { SessionUser } from '../../server/auth.server.js'

const itemClass =
  'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium text-slate-500 [&.active]:text-brand-700'

/** Bottom tab bar shown below the `sm` breakpoint, where the header nav is hidden. */
export function MobileNav({ user }: { user: SessionUser }) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
    >
      <div className="flex">
        <Link to="/rooms" className={itemClass}>
          <DoorOpen className="h-5 w-5" />
          Rooms
        </Link>
        <Link to="/bookings" className={itemClass}>
          <CalendarClock className="h-5 w-5" />
          My Bookings
        </Link>
        {user.role === 'admin' && (
          <>
            <Link to="/admin/rooms" className={itemClass}>
              <Shield className="h-5 w-5" />
              Admin
            </Link>
            <Link to="/admin/bookings" className={itemClass}>
              <ListChecks className="h-5 w-5" />
              All
            </Link>
            <Link to="/admin/analytics" className={itemClass}>
              <BarChart3 className="h-5 w-5" />
              Analytics
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
