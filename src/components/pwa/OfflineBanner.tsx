import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '../../lib/pwa.js'

export function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null
  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-sm font-medium text-amber-900"
    >
      <WifiOff className="h-4 w-4" />
      You're offline. Availability may be out of date and bookings can't be
      changed until you reconnect.
    </div>
  )
}
