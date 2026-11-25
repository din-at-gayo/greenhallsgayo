import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { getMe } from '../server/auth.functions.js'
import { getRoomUtilization } from '../server/analytics.functions.js'
import { ANALYTICS_RANGES, type AnalyticsRange } from '../lib/analytics.js'
import { NO_SHOW_GRACE_MINUTES } from '../lib/checkin.js'
import { OFFICE_TIME_ZONE } from '../lib/time.js'

export const Route = createFileRoute('/_app/admin/analytics')({
  validateSearch: z.object({
    days: z
      .number()
      .int()
      .refine((d) => (ANALYTICS_RANGES as readonly number[]).includes(d))
      .catch(30)
      .default(30),
  }),
  beforeLoad: async () => {
    const user = await getMe()
    if (!user || user.role !== 'admin') {
      throw redirect({ to: '/rooms' })
    }
  },
  loaderDeps: ({ search }) => ({ days: search.days }),
  loader: async ({ deps }) => {
    const report = await getRoomUtilization({ data: { days: deps.days } })
    return { report }
  },
  component: Analytics,
})

const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
}

// Hatched amber marks no-show time, so it never relies on color alone.
const NO_SHOW_FILL =
  'repeating-linear-gradient(135deg, #d97706 0 3px, #fbbf24 3px 6px)'

function pct(part: number, whole: number) {
  return whole > 0 ? part / whole : 0
}

function formatPct(rate: number | null) {
  if (rate === null) return '—'
  if (rate > 0 && rate < 0.01) return '<1%'
  return `${Math.round(rate * 100)}%`
}

function hours(minutes: number) {
  const h = minutes / 60
  return h >= 10 ? `${Math.round(h)}h` : `${Math.round(h * 10) / 10}h`
}

function hourLabel(hour: number) {
  const suffix = hour < 12 ? 'am' : 'pm'
  const h = hour % 12 === 0 ? 12 : hour % 12
  return `${h}${suffix}`
}

// Sequential brand-green ramp for the heatmap, light → dark.
const HEAT_STEPS = [
  { min: 0.8, bg: 'bg-brand-800', text: 'text-white' },
  { min: 0.6, bg: 'bg-brand-600', text: 'text-white' },
  { min: 0.4, bg: 'bg-brand-400', text: 'text-slate-900' },
  { min: 0.2, bg: 'bg-brand-200', text: 'text-slate-900' },
  { min: 0.01, bg: 'bg-brand-100', text: 'text-slate-700' },
  { min: 0, bg: 'bg-slate-100', text: 'text-slate-500' },
]

function heatStep(rate: number) {
  return HEAT_STEPS.find((s) => rate >= s.min) ?? HEAT_STEPS[HEAT_STEPS.length - 1]
}

function Analytics() {
  const { report } = Route.useLoaderData()
  const { days } = Route.useSearch()
  const { totals } = report

  const occupancy = pct(totals.occupiedMinutes, totals.capacityMinutes)
  const bookedRate = pct(totals.bookedMinutes, totals.capacityMinutes)
  const tracked = totals.checkedIn + totals.noShows
  const checkInRate = tracked > 0 ? totals.checkedIn / tracked : null

  let peak: { weekday: number; hour: number; rate: number } | null = null
  for (const row of report.heatmap) {
    for (const cell of row.hours) {
      if (cell.rate !== null && cell.rate > 0 && (!peak || cell.rate > peak.rate)) {
        peak = { weekday: row.weekday, hour: cell.hour, rate: cell.rate }
      }
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Room utilization
          </h1>
          <p className="text-sm text-slate-500">
            How much of the working week rooms are actually in use, and how
            often bookings go unclaimed.
          </p>
        </div>
        <div
          className="inline-flex rounded-md border border-slate-200 bg-white p-0.5"
          role="group"
          aria-label="Date range"
        >
          {ANALYTICS_RANGES.map((range: AnalyticsRange) => (
            <Link
              key={range}
              to="/admin/analytics"
              search={{ days: range }}
              aria-pressed={range === days}
              className={`px-3 py-1 text-sm font-medium rounded ${
                range === days
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {range} days
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatTile
          label="Occupancy"
          value={formatPct(occupancy)}
          detail={`${hours(totals.occupiedMinutes)} of ${hours(totals.capacityMinutes)} room-hours`}
        />
        <StatTile
          label="Booked"
          value={formatPct(bookedRate)}
          detail="Including no-shows"
        />
        <StatTile
          label="Check-in rate"
          value={formatPct(checkInRate)}
          detail={
            tracked > 0
              ? `${totals.checkedIn} of ${tracked} meetings`
              : 'No check-in data yet'
          }
        />
        <StatTile
          label="No-shows released"
          value={String(totals.noShows)}
          detail={`${hours(totals.recoveredMinutes)} handed back for rebooking`}
        />
      </div>

      <section className="bg-white border border-slate-200 rounded-lg p-5 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="font-semibold text-slate-900">By room</h2>
            <p className="text-xs text-slate-500">
              Share of office hours each room was occupied or held by a no-show.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-brand-600" />
              Occupied
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-sm"
                style={{ background: NO_SHOW_FILL }}
              />
              No-show (released)
            </span>
          </div>
        </div>

        {report.rooms.length === 0 ? (
          <p className="text-sm text-slate-500">No rooms to report on.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-500 text-left">
                <tr>
                  <th className="py-2 pr-4 font-medium">Room</th>
                  <th className="py-2 pr-4 font-medium w-1/3 min-w-40">
                    Utilization
                  </th>
                  <th className="py-2 pr-4 font-medium text-right">Occupied</th>
                  <th className="py-2 pr-4 font-medium text-right">Meetings</th>
                  <th className="py-2 pr-4 font-medium text-right">Check-in</th>
                  <th className="py-2 font-medium text-right">No-shows</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.rooms.map((room) => {
                  const occupied = pct(room.occupiedMinutes, room.capacityMinutes)
                  const noShow = pct(
                    room.bookedMinutes - room.occupiedMinutes,
                    room.capacityMinutes,
                  )
                  const roomTracked = room.checkedIn + room.noShows
                  return (
                    <tr key={room.roomId}>
                      <td className="py-2.5 pr-4">
                        <div className="font-medium text-slate-900">
                          {room.name}
                          {!room.isActive && (
                            <span className="ml-2 text-xs font-normal text-slate-400">
                              inactive
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">
                          {room.location}
                        </div>
                      </td>
                      <td className="py-2.5 pr-4">
                        <div
                          className="group relative h-3 rounded bg-slate-100 flex gap-0.5"
                          role="img"
                          aria-label={`${room.name}: ${formatPct(occupied)} occupied, ${formatPct(noShow)} held by no-shows`}
                        >
                          {occupied > 0 && (
                            <div
                              className="h-full bg-brand-600 rounded-l"
                              style={{ width: `${Math.min(occupied, 1) * 100}%` }}
                            />
                          )}
                          {noShow > 0 && (
                            <div
                              className="h-full rounded-r"
                              style={{
                                width: `${Math.min(noShow, 1) * 100}%`,
                                background: NO_SHOW_FILL,
                              }}
                            />
                          )}
                          <div className="pointer-events-none absolute left-0 -top-9 z-10 hidden group-hover:block whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs text-white shadow">
                            {hours(room.occupiedMinutes)} occupied ·{' '}
                            {hours(room.bookedMinutes - room.occupiedMinutes)}{' '}
                            no-show · {hours(room.capacityMinutes)} available
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-slate-900 font-medium">
                        {formatPct(occupied)}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-slate-700">
                        {room.meetings}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-slate-700">
                        {roomTracked > 0
                          ? formatPct(room.checkedIn / roomTracked)
                          : '—'}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-slate-700">
                        {room.noShows}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="font-semibold text-slate-900">Busiest times</h2>
            <p className="text-xs text-slate-500">
              Average occupancy across all rooms by weekday and hour.
              {peak &&
                ` Peak: ${WEEKDAY_LABELS[peak.weekday]} ${hourLabel(peak.hour)} at ${formatPct(peak.rate)}.`}
            </p>
          </div>
          <HeatLegend />
        </div>
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-0.5 text-xs">
            <thead>
              <tr>
                <th />
                {report.heatmap[0]?.hours.map((cell) => (
                  <th
                    key={cell.hour}
                    className="font-normal text-slate-500 px-1 pb-1 min-w-12"
                  >
                    {hourLabel(cell.hour)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.heatmap.map((row) => (
                <tr key={row.weekday}>
                  <th className="font-normal text-slate-500 pr-2 text-left">
                    {WEEKDAY_LABELS[row.weekday]}
                  </th>
                  {row.hours.map((cell) => {
                    const label = `${WEEKDAY_LABELS[row.weekday]} ${hourLabel(cell.hour)}–${hourLabel(cell.hour + 1)}: ${
                      cell.rate === null ? 'no data yet' : `${formatPct(cell.rate)} occupied`
                    }`
                    if (cell.rate === null) {
                      return (
                        <td
                          key={cell.hour}
                          title={label}
                          className="h-9 rounded border border-dashed border-slate-200 text-center text-slate-300"
                        >
                          ·
                        </td>
                      )
                    }
                    const step = heatStep(cell.rate)
                    return (
                      <td
                        key={cell.hour}
                        title={label}
                        className={`h-9 rounded text-center tabular-nums hover:ring-2 hover:ring-slate-900 ${step.bg} ${step.text}`}
                      >
                        {formatPct(cell.rate)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-slate-500">
        Covers the last {days} days up to now, Monday–Friday{' '}
        {hourLabel(report.businessHours.start)}–
        {hourLabel(report.businessHours.end)} office time ({OFFICE_TIME_ZONE}).
        Bookings nobody checks into within {NO_SHOW_GRACE_MINUTES} minutes are
        released and count as no-shows, not occupied time. Check-in rate only
        counts meetings since check-in was introduced.
      </p>
    </div>
  )
}

function StatTile({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-2xl font-semibold text-slate-900 tabular-nums mt-1">
        {value}
      </p>
      <p className="text-xs text-slate-500 mt-0.5">{detail}</p>
    </div>
  )
}

function HeatLegend() {
  const steps = [...HEAT_STEPS].reverse()
  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-500">
      <span>0%</span>
      {steps.map((s) => (
        <span key={s.bg} className={`w-4 h-3 rounded-sm ${s.bg}`} />
      ))}
      <span>80%+</span>
    </div>
  )
}
