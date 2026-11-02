/* Reading and writing bookings. See db.js for how availability is counted. */

import { q, tx, HOLDING, takenSql, lockRoom, BOOKING_COLS } from "./db.js";
import { ROOMS, HOLD_MINUTES } from "./rooms.js";
import { bookingId, transactionUuid } from "./http.js";

/* Rooms left of every type for a stay: the busiest night decides. */
export async function availability(checkIn, checkOut) {
  const rows = await q(
    `SELECT r.code, r.count, COALESCE(MAX(t.taken), 0)::int AS taken
     FROM room_types r
     LEFT JOIN (
       SELECT b.room_code, d.night, SUM(b.rooms) AS taken
       FROM generate_series($1::date, $2::date - 1, interval '1 day') AS d(night)
       JOIN bookings b ON b.check_in <= d.night::date AND b.check_out > d.night::date AND ${HOLDING}
       GROUP BY b.room_code, d.night
     ) t ON t.room_code = r.code
     GROUP BY r.code, r.count`, [checkIn, checkOut]);
  return ROOMS.map(room => {
    const row = rows.find(x => x.code === room.code) || { count: 0, taken: 0 };
    const count = Number(row.count), taken = Number(row.taken);
    return { code: room.code, count, taken, left: Math.max(0, count - taken) };
  });
}

/* Writes a booking if the rooms are free, under the room type's lock.
   status: "pending" (a guest about to pay) or "blocked" (staff).
   force (staff only): write it even if the system thinks the type is full.
   Returns { id, uuid } or { error: "full" }. */
export async function createBooking(b, { force = false } = {}) {
  const id = bookingId();
  const uuid = b.status === "pending" ? transactionUuid(id) : null;
  const params = [id, b.room, b.rooms, b.checkIn, b.checkOut, b.guests, !!b.breakfast,
    b.name || "", b.email || "", b.phone || "", b.notes || "", b.total || 0, b.status, uuid, b.source || "web"];
  const check = force ? "" : `WHERE (SELECT count FROM room_types WHERE code = $2) - ${takenSql("$2", "$4", "$5")} >= $3::int`;
  const [, inserted] = await tx([
    lockRoom(b.room),
    [`INSERT INTO bookings (id, room_code, rooms, check_in, check_out, guests, breakfast, name, email, phone, notes, amount, status, transaction_uuid, source)
      SELECT $1::text, $2::text, $3::int, $4::date, $5::date, $6::int, $7::boolean, $8::text, $9::text, $10::text, $11::text, $12::int, $13::text, $14::text, $15::text ${check}
      RETURNING id`, params]
  ]);
  return inserted.length ? { id, uuid } : { error: "full" };
}

export async function byUuid(uuid) {
  const rows = await q(`SELECT ${BOOKING_COLS} FROM bookings WHERE transaction_uuid = $1`, [uuid]);
  return rows[0] || null;
}

export async function byId(id) {
  const rows = await q(`SELECT ${BOOKING_COLS} FROM bookings WHERE id = $1`, [id]);
  return rows[0] || null;
}

/* eSewa has confirmed the payment. Marks the booking paid — or, if its hold
   had run out and the rooms were taken meanwhile, paid_conflict, so the
   hotel knows to sort it out. Safe to call twice: only a pending or failed
   booking changes. Returns the booking as it now stands. */
export async function confirmPayment(b, ref) {
  await tx([
    lockRoom(b.room_code),
    [`UPDATE bookings AS t SET
        status = CASE
          WHEN t.status = 'pending' AND t.created_at > now() - interval '${Number(HOLD_MINUTES)} minutes' THEN 'paid'
          WHEN (SELECT count FROM room_types WHERE code = t.room_code) - ${takenSql("t.room_code", "t.check_in", "t.check_out", "t.id")} >= t.rooms THEN 'paid'
          ELSE 'paid_conflict' END,
        esewa_ref = $2, updated_at = now()
      WHERE t.transaction_uuid = $1 AND t.status IN ('pending', 'failed')`, [b.transaction_uuid, ref || null]]
  ]);
  return byUuid(b.transaction_uuid);
}

/* Claims the right to send this booking's emails: true for exactly one caller. */
export async function claimEmail(id) {
  const rows = await q(`UPDATE bookings SET emailed = true WHERE id = $1 AND NOT emailed RETURNING id`, [id]);
  return rows.length === 1;
}

/* The guest left eSewa without paying: free the rooms now rather than when
   the hold runs out. */
export async function markFailed(uuid) {
  await q(`UPDATE bookings SET status = 'failed', updated_at = now() WHERE transaction_uuid = $1 AND status = 'pending'`, [uuid]);
}
