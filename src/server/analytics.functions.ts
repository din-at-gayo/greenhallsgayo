import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getCurrentUser } from './auth.server.js'
import { releaseNoShows } from './checkin.server.js'
import { getUtilizationReport } from './analytics.server.js'
import { ANALYTICS_RANGES } from '../lib/analytics.js'

export const getRoomUtilization = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      days: z
        .number()
        .int()
        .refine((d) => (ANALYTICS_RANGES as readonly number[]).includes(d)),
    }),
  )
  .handler(async ({ data }) => {
    const user = await getCurrentUser()
    if (!user || user.role !== 'admin') throw new Error('Admin access required')
    // Make sure overdue no-shows are counted as released, not as occupied.
    await releaseNoShows()
    return getUtilizationReport(data.days)
  })
