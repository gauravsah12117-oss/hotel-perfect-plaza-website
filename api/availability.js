/* GET /api/availability?in=YYYY-MM-DD&out=YYYY-MM-DD
   Every room type: its prices and how many are free for those dates. */

import { ROOMS, EXTRA_PERSON, MAX_EXTRA_PER_ROOM, SERVICE_CHARGE, VAT, MAX_ROOMS, quote } from "./_lib/rooms.js";
import { availability } from "./_lib/bookings.js";
import { config } from "./_lib/esewa.js";
import { json, handle, only } from "./_lib/http.js";

export default handle(async (req, res) => {
  if (!only(req, res, "GET")) return;
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
