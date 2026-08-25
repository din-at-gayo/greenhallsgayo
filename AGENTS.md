# AGENTS.md

Working notes for agents and developers changing this codebase.

## Stack

- **TanStack Start** (React 19) with **TanStack Router** file-based routing
- **Vite 7** + **Tailwind CSS 4** (`@tailwindcss/vite`), `lucide-react` icons
- **Netlify Database** (managed Postgres) accessed through **Drizzle ORM**
- **Zod v4** for server-function input validation
- **pnpm** as the package manager

## Layout

```
db/
  schema.ts              Drizzle table definitions (users, rooms, bookings)
  index.ts               drizzle client (drizzle-orm/netlify-db)
drizzle.config.ts        points `out` at netlify/database/migrations
netlify/database/migrations/
                         SQL migrations, applied by Netlify on deploy
src/
  routes/                file-based routes (routeTree.gen.ts is generated)
  components/            Header, BookingFormModal
  lib/time.ts            wall-clock date/time helpers
  server/
    *.server.ts          server-only DB/session helpers — never import in a component
    *.functions.ts       createServerFn endpoints — the only thing routes may call
```

## Rules that matter here

**Drizzle must stay on the beta line.** `drizzle-orm` and `drizzle-kit` are
pinned to `1.0.0-beta.*`; the `drizzle-orm/netlify-db` adapter does not exist on
the stable line. Do not "upgrade" them to a 0.x release.

**Migrations are platform-applied.** Generate with
`npx drizzle-kit generate --name=...` so files land in
`netlify/database/migrations/`. Never run `drizzle-kit migrate`, `drizzle-kit
push`, or DDL through `netlify db connect` — Netlify applies pending migrations
at deploy time. Seed data goes in its own hand-written migration.

**Server functions use `.inputValidator(...)`, not `.validator(...)`.** The
latter does not exist in this version of `@tanstack/react-start`.

**Loaders are isomorphic.** A route loader runs on both server and client, so it
must call a server function (`getRooms()`, `getMyBookings()`, …) and never touch
`db` directly. Anything importing `db/index.ts` belongs in `src/server/`.

**Conflict checks live on the server.** `findOverlappingBooking()` in
`src/server/bookings.server.ts` is the single source of truth for double-booking
prevention, and both `createBooking` and `updateBooking` call it. When editing,
pass the booking's own id as `excludeBookingId` so it does not conflict with
itself. Never move this check into the UI.

**Times are wall-clock strings.** `bookings.start_time` / `end_time` use Drizzle
`timestamp(..., { mode: 'string' })`, so values round-trip as
`YYYY-MM-DDTHH:mm` with no UTC conversion. This is intentional for the
single-office scope. Introducing multiple time zones means changing the column
mode and every helper in `src/lib/time.ts` together.

**Auth.** Passwords are scrypt-hashed (`salt:hash`) in `auth.server.ts` and
compared with `timingSafeEqual`. The session is an encrypted cookie via
`useSession` keyed by `SESSION_SECRET`. Route protection is done by
`beforeLoad`: `src/routes/_app.tsx` is a pathless layout that redirects
anonymous visitors to `/login` and puts `user` into route context; admin routes
add their own `beforeLoad` check on top and also re-check on the server via
`requireAdmin()` / the `user.role !== 'admin'` guard in the server function. The
client guard is convenience only — the server guard is what enforces it.

**Signup always creates employees.** Admin role is assigned in the database, not
through the UI.

## TypeScript

`strict`, `noUnusedLocals`, and `noUnusedParameters` are all on — an unused
import or variable fails the build. Relative imports use the ESM `.js`
extension.
