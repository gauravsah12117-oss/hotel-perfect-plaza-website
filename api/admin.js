/* /api/admin?action=…  — for the front desk's page, admin.html.
   Every call needs the header  Authorization: Bearer <ADMIN_PASSWORD>.

   GET  action=bookings&from=&to=   bookings staying any night in the range,
                                    plus any made in the last 3 days
   GET  action=grid&from=&days=     rooms left per type, night by night
   GET  action=rooms                how many rooms of each type
   POST action=rooms   { counts: { deluxe: 6, … } }
   POST action=block   { room, checkIn, checkOut, rooms, name, phone, notes, force }
                       a walk-in, a phone booking, or rooms out of use
   POST action=cancel  { id }       refunds are made in the eSewa merchant portal */

import { createHash, timingSafeEqual } from "node:crypto";
import { q, BOOKING_COLS, HOLDING } from "./_lib/db.js";
import { createBooking } from "./_lib/bookings.js";
import { ROOMS, byCode, parseDay, todayNepal } from "./_lib/rooms.js";
import { config as esewaConfig } from "./_lib/esewa.js";
import { json, body, handle, clean, cleanText } from "./_lib/http.js";

const digest = s => createHash("sha256").update(String(s)).digest();

function authorised(req) {
  const pass = process.env.ADMIN_PASSWORD;
  if (!pass) return null;                           /* not set up */
  const given = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  return given.length > 0 && timingSafeEqual(digest(given), digest(pass));
}

const DAY = 86400000;
const addDays = (s, n) => new Date(parseDay(s) + n * DAY).toISOString().slice(0, 10);
const okDay = s => parseDay(String(s || "")) !== null;

export default handle(async (req, res) => {
  const auth = authorised(req);
  if (auth === null) return json(res, 503, { error: "setup" });
  if (!auth) { await new Promise(r => setTimeout(r, 600)); return json(res, 401, { error: "password" }); }

  const action = String(req.query.action || "");
  const b = body(req);

  if (req.method === "GET" && action === "bookings") {
    const from = okDay(req.query.from) ? req.query.from : addDays(todayNepal(), -1);
    const to = okDay(req.query.to) ? req.query.to : addDays(from, 31);
    const rows = await q(
      `SELECT ${BOOKING_COLS}, (status = 'pending' AND NOT (${HOLDING.replace(/\bb\./g, "bookings.")})) AS expired
       FROM bookings
       WHERE (check_out > $1::date AND check_in < $2::date) OR created_at > now() - interval '3 days'
       ORDER BY check_in, created_at`, [from, to]);
    return json(res, 200, { from, to, bookings: rows.map(r => ({ ...r, roomName: (byCode(r.room_code) || {}).name || r.room_code })) });
  }

  if (req.method === "GET" && action === "grid") {
    const from = okDay(req.query.from) ? req.query.from : todayNepal();
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 14, 1), 62);
    const rows = await q(
      `SELECT r.code, d.night::date::text AS night, r.count - COALESCE(SUM(b.rooms), 0)::int AS left
       FROM room_types r
       CROSS JOIN generate_series($1::date, $1::date + ($2::int - 1), interval '1 day') AS d(night)
       LEFT JOIN bookings b ON b.room_code = r.code AND b.check_in <= d.night::date AND b.check_out > d.night::date AND ${HOLDING}
       GROUP BY r.code, r.count, d.night ORDER BY d.night`, [from, days]);
    const nights = [...new Set(rows.map(r => r.night))];
    return json(res, 200, {
      nights,
      rooms: ROOMS.map(r => ({ code: r.code, name: r.name, left: nights.map(n => Number((rows.find(x => x.code === r.code && x.night === n) || {}).left)) }))
    });
  }

  if (action === "rooms") {
    if (req.method === "POST") {
      const counts = b.counts || {};
      for (const r of ROOMS) {
        if (!(r.code in counts)) continue;
        const n = Number(counts[r.code]);
        if (!Number.isInteger(n) || n < 0 || n > 500) return json(res, 400, { error: "count", room: r.code });
        await q(`UPDATE room_types SET count = $2 WHERE code = $1`, [r.code, n]);
      }
    }
    const rows = await q(`SELECT code, count FROM room_types`);
    let payment = null; try { payment = esewaConfig().mode; } catch (e) {}
    return json(res, 200, { payment, rooms: ROOMS.map(r => ({ code: r.code, name: r.name, count: Number((rows.find(x => x.code === r.code) || {}).count || 0) })) });
  }

  if (req.method === "POST" && action === "block") {
    const room = byCode(b.room);
    if (!room) return json(res, 400, { error: "room" });
    if (!okDay(b.checkIn) || !okDay(b.checkOut) || parseDay(b.checkOut) <= parseDay(b.checkIn)) return json(res, 400, { error: "dates" });
    const rooms = Number(b.rooms) || 1;
    if (!Number.isInteger(rooms) || rooms < 1 || rooms > 100) return json(res, 400, { error: "rooms" });
    const made = await createBooking({
      room: room.code, rooms, checkIn: b.checkIn, checkOut: b.checkOut, guests: Number(b.guests) || rooms,
      name: clean(b.name, 120) || "Front desk", phone: clean(b.phone, 40), notes: cleanText(b.notes, 1000),
      total: Math.max(0, Math.round(Number(b.amount) || 0)), status: "blocked", source: "staff"
    }, { force: b.force === true });
    if (made.error) return json(res, 409, { error: "full" });
    return json(res, 200, { id: made.id });
  }

  if (req.method === "POST" && action === "cancel") {
    const rows = await q(`UPDATE bookings SET status = 'cancelled', updated_at = now()
      WHERE id = $1 AND status IN ('pending','paid','blocked','paid_conflict') RETURNING id`, [clean(b.id, 20)]);
    return json(res, rows.length ? 200 : 404, rows.length ? { ok: true } : { error: "unknown" });
  }

  json(res, 400, { error: "action" });
});
