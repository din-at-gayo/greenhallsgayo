import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: serial().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text().notNull().default('employee'), // 'employee' | 'admin'
  // Secret token for the user's private iCal feed (Google Calendar subscription).
  calendarToken: text('calendar_token').unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const rooms = pgTable('rooms', {
  id: serial().primaryKey(),
  name: text().notNull(),
  location: text().notNull(),
  floor: text(),
  capacity: integer().notNull(),
  equipment: text().array().notNull().default([]),
  photoUrl: text('photo_url'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const bookings = pgTable('bookings', {
  id: serial().primaryKey(),
  roomId: integer('room_id')
    .notNull()
    .references(() => rooms.id),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  title: text().notNull(),
  description: text().default(''),
  // Stored as plain wall-clock strings: the app assumes a single office time zone.
  startTime: timestamp('start_time', { mode: 'string' }).notNull(),
  endTime: timestamp('end_time', { mode: 'string' }).notNull(),
  attendees: text().array().notNull().default([]),
  status: text().notNull().default('confirmed'), // 'confirmed' | 'cancelled'
  // Shared by every occurrence of a recurring booking; null for one-off bookings.
  seriesId: text('series_id'),
  recurrence: text(), // 'daily' | 'weekly' | 'biweekly' | 'monthly' | null
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
