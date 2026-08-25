# RoomBook — Internal Meeting Room Booking

A small internal tool for booking office meeting rooms. Employees browse rooms,
check a room's availability for a given day, and book a slot. Admins manage the
room directory and can cancel any booking.

Built with TanStack Start (React 19 + TanStack Router), Tailwind CSS 4, Drizzle
ORM, and Netlify Database (managed Postgres).

## Features

- **Room directory** — name, location, floor, capacity, equipment, optional photo.
  Search by name/location and filter by minimum capacity and equipment.
- **Room detail / availability** — pick a day and see every confirmed booking for
  that room, then book an open slot.
- **Booking flow** — room, date, start/end time, title, optional description and
  attendee emails. Overlaps are rejected **on the server**, so a stale UI or a
  direct API call cannot double-book a room.
- **My Bookings** — upcoming vs. past & cancelled; edit or cancel your own
  upcoming bookings.
- **Quick book** — "Book a room now" opens the booking form pre-filled with the
  next 15-minute slot.
- **Accounts and roles** — email/password sign-up and login. `employee` can book
  rooms; `admin` can additionally manage rooms and view/cancel all bookings.
- **Notifications** — booking created / updated / cancelled events, plus attendee
  invites, are emitted through a single `notify()` function.

## Getting started

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

The app needs a Netlify Database. On Netlify it is provisioned and wired up
automatically; locally, run the dev server through the Netlify CLI so the
database environment is injected:

```bash
netlify dev
```

Migrations in `netlify/database/migrations/` are applied automatically by
Netlify on deploy — do not run `drizzle-kit migrate` or `push` by hand.

To change the schema:

```bash
# edit db/schema.ts, then:
npx drizzle-kit generate --name=describe_your_change
```

## Demo accounts

The seed migration creates two accounts and one room.

| Role     | Email                  | Password      |
| -------- | ---------------------- | ------------- |
| Admin    | `admin@example.com`    | `password123` |
| Employee | `employee@example.com` | `password123` |

Seeded room: **Falcon** — HQ - Downtown, 3rd Floor, seats 8, projector / video
conferencing / whiteboard.

These are demo credentials for a throwaway environment. Change or remove them
before using this with real data.

## Environment variables

| Variable         | Required     | Purpose                                                                                   |
| ---------------- | ------------ | ----------------------------------------------------------------------------------------- |
| `SESSION_SECRET` | Yes in prod  | Encrypts the session cookie. Must be at least 32 characters. Falls back to an insecure dev default when unset. |

The database connection is provided by Netlify Database; no manual connection
string is needed.

## Notes and known limits

- **Email is stubbed.** `src/server/notifications.server.ts` logs each
  notification instead of sending it. Swap the body of `notify()` for a real
  provider (Resend, SendGrid, SES) to turn these into real emails.
- **Single time zone.** Times are stored and displayed as plain wall-clock
  values with no time-zone conversion, matching a single-office deployment.
- **Cancellations are soft.** Cancelling sets `status = 'cancelled'`; the row is
  kept so it still appears under "Past & Cancelled".

## Not built (possible v2)

Deliberately out of scope for this MVP, listed here so they are not lost:
recurring bookings, check-in with auto-release of no-shows, room utilization
analytics, Google Calendar / Outlook integration, and a mobile app or PWA.
