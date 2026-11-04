/* ==========================================================================
   The database: Postgres (Neon, from the Vercel Marketplace) in production.
   --------------------------------------------------------------------------
   Two tables:
     room_types  how many rooms of each type the hotel has (staff set this
                 on admin.html); prices are in rooms.js, not here
     bookings    every booking, hold and staff block

   The tables create themselves the first time the API runs, so a fresh
   database needs no setup beyond DATABASE_URL.

   Everything goes through q() for one statement and tx() for several in one
   transaction, so the local tests (dev/, on PGlite) run the same SQL.

   Availability is never stored, only counted: a room is taken on a night
   by every booking that is paid, blocked by staff, or still being paid for
   (pending, made in the last HOLD_MINUTES). Bookings are written with a
   per-room-type lock and the count re-checked inside the same transaction,
   so two guests can never both get the last room.
   ========================================================================== */

import { ROOMS, HOLD_MINUTES } from "./rooms.js";

let driver = null;
let ready = null;

/* For the local dev server and tests: use another driver (PGlite). */
export function useDriver(d) { driver = d; ready = null; }

async function neonDriver() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw Object.assign(new Error("DATABASE_URL is not set"), { code: "NO_DB" });
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(url);
  return {
    query: (text, params = []) => sql.query(text, params),
    tx: queries => sql.transaction(queries.map(([text, params = []]) => sql.query(text, params)))
  };
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS room_types (
     code  text PRIMARY KEY,
     count integer NOT NULL DEFAULT 0 CHECK (count >= 0)
   )`,
  `CREATE TABLE IF NOT EXISTS bookings (
     id               text PRIMARY KEY,
     room_code        text NOT NULL REFERENCES room_types(code),
     rooms            integer NOT NULL CHECK (rooms > 0),
     check_in         date NOT NULL,
     check_out        date NOT NULL CHECK (check_out > check_in),
     guests           integer NOT NULL DEFAULT 1,
     breakfast        boolean NOT NULL DEFAULT false,
     name             text NOT NULL DEFAULT '',
     email            text NOT NULL DEFAULT '',
     phone            text NOT NULL DEFAULT '',
     notes            text NOT NULL DEFAULT '',
     amount           integer NOT NULL DEFAULT 0,
     status           text NOT NULL CHECK (status IN ('pending','paid','failed','cancelled','blocked','paid_conflict')),
     transaction_uuid text UNIQUE,
     esewa_ref        text,
     source           text NOT NULL DEFAULT 'web',
     emailed          boolean NOT NULL DEFAULT false,
     created_at       timestamptz NOT NULL DEFAULT now(),
     updated_at       timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS bookings_room_dates ON bookings (room_code, check_in, check_out)`,
  /* every room type exists, with 0 rooms until staff set the real number */
  `INSERT INTO room_types (code) VALUES ${ROOMS.map((_, i) => `($${i + 1})`).join(", ")} ON CONFLICT (code) DO NOTHING`
];

/* Other parts of the system (staff attendance) add their own tables here. */
const EXTRA = [];
export function addSchema(statements) { EXTRA.push(...statements); ready = null; }

/* Creates the tables once per running instance. */
async function ensure() {
  if (!driver) driver = await neonDriver();
  if (!ready) {
    ready = (async () => {
      for (const s of SCHEMA) await driver.query(s, s.startsWith("INSERT") ? ROOMS.map(r => r.code) : []);
      for (const s of EXTRA) await driver.query(s, []);
    })().catch(e => { ready = null; throw e; });
  }
  await ready;
  return driver;
}

export async function q(text, params) { return (await ensure()).query(text, params); }
export async function tx(queries) { return (await ensure()).tx(queries); }

/* ------------------------------------------------------------ SQL pieces */

/* Does booking b hold its rooms right now? */
export const HOLDING = `(b.status IN ('paid','blocked','paid_conflict')
  OR (b.status = 'pending' AND b.created_at > now() - interval '${Number(HOLD_MINUTES)} minutes'))`;

/* The busiest night's rooms taken, for one room type ($room) over a stay
   ($in to $out, check-out day not included), leaving out booking $self. */
export const takenSql = (room, inP, outP, self = "NULL") => `COALESCE((
  SELECT MAX(x.taken) FROM (
    SELECT SUM(b.rooms) AS taken
    FROM generate_series(${inP}::date, ${outP}::date - 1, interval '1 day') AS d(night)
    JOIN bookings b ON b.room_code = ${room} AND b.check_in <= d.night::date AND b.check_out > d.night::date
      AND ${HOLDING} AND b.id IS DISTINCT FROM ${self}
    GROUP BY d.night) x), 0)`;

/* A transaction-scoped lock per room type: bookings for the same type queue
   up behind each other; different types do not wait. */
export const lockRoom = code => [`SELECT pg_advisory_xact_lock(hashtext($1))`, ["hpp-room:" + code]];

/* The columns a booking is read back with: dates as plain text, so no
   driver turns them into midnight-in-some-timezone Date objects. */
export const BOOKING_COLS = `id, room_code, rooms, check_in::text AS check_in, check_out::text AS check_out,
  guests, breakfast, name, email, phone, notes, amount, status, transaction_uuid, esewa_ref, source,
  emailed, to_char(created_at AT TIME ZONE 'Asia/Kathmandu', 'YYYY-MM-DD HH24:MI') AS created_at`;
