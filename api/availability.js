/* GET /api/availability?in=YYYY-MM-DD&out=YYYY-MM-DD
   Every room type: its prices and how many are free for those dates. */

import { ROOMS, EXTRA_PERSON, MAX_EXTRA_PER_ROOM, SERVICE_CHARGE, VAT, MAX_ROOMS, quote } from "./_lib/rooms.js";
import { availability } from "./_lib/bookings.js";
import { config } from "./_lib/esewa.js";
import { q } from "./_lib/db.js";
import { json, handle, only } from "./_lib/http.js";

export default handle(async (req, res) => {
  if (!only(req, res, "GET")) return;

  /* ?ping=1 — is online booking switched on? Yes once the database is
     connected and staff have entered at least one room on admin.html.
     Until then booking.js leaves "Book now" going to the enquiry form. */
  if (req.query.ping) {
    let ready = false;
    try { ready = Number((await q(`SELECT COALESCE(SUM(count), 0)::int AS n FROM room_types`))[0].n) > 0; } catch (e) { ready = false; }
    let payment = null; try { payment = config().mode; } catch (e) { ready = false; }
    return json(res, 200, { ready, payment });
  }

  const checkIn = String(req.query.in || ""), checkOut = String(req.query.out || "");
  /* the dates are checked once, against any room */
  const v = quote({ room: ROOMS[0], checkIn, checkOut, rooms: 1, guests: 1 });
  if (!v.ok) return json(res, 400, { error: v.error });

  const left = await availability(checkIn, checkOut);
  json(res, 200, {
    checkIn, checkOut, nights: v.nights,
    pricing: { extraPerson: EXTRA_PERSON, maxExtraPerRoom: MAX_EXTRA_PER_ROOM, serviceCharge: SERVICE_CHARGE, vat: VAT, maxRooms: MAX_ROOMS },
    payment: config().mode,
    rooms: ROOMS.map(r => ({
      code: r.code, name: r.name, short: r.short, rate: r.rate, breakfast: r.breakfast, maxGuests: r.maxGuests,
      left: left.find(x => x.code === r.code).left
    }))
  });
});
