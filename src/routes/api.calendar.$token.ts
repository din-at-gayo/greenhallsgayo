import { createFileRoute } from '@tanstack/react-router'
import {
  buildCalendarFeed,
  findUserByCalendarToken,
} from '../server/calendar.server.js'

// Private iCal feed that Google Calendar (or any calendar app) subscribes to.
// The unguessable token in the URL is the credential, so no session is needed.
export const Route = createFileRoute('/api/calendar/$token')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const token = params.token.replace(/\.ics$/, '')
        const user = token ? await findUserByCalendarToken(token) : null
        if (!user) {
          return new Response('Calendar not found', { status: 404 })
        }

        const body = await buildCalendarFeed(user, new URL(request.url).host)
        return new Response(body, {
          headers: {
            'Content-Type': 'text/calendar; charset=utf-8',
            'Content-Disposition': 'inline; filename="roombook.ics"',
            'Cache-Control': 'private, max-age=300',
          },
        })
      },
    },
  },
})
