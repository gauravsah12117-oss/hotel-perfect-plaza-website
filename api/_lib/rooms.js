/* ==========================================================================
   The room plan: the one place the booking system takes its prices from.
   --------------------------------------------------------------------------
   Prices are the hotel's own room plan (October 2026), in NPR. The server
   works out every total from here; the browser is never trusted with an
   amount. When a rate changes, change it here AND on the page (the room
   cards and the rates card in index.html, and i18n-ne.js).

   How many rooms of each type there are is NOT here: it lives in the
   database, so staff can change it on the admin page (admin.html).

   `name` must match the enquiry form's <option value> in index.html, and the
   room cards' data-room, exactly.
   ========================================================================== */

export const ROOMS = [
  { code: "single",   name: "Single Room — non-AC",              short: "Single room",     rate: 1500, breakfast: 1100, maxGuests: 1 },
  { code: "deluxe",   name: "Deluxe Room — AC, attached bath",   short: "Deluxe room",     rate: 2500, breakfast: 1100, maxGuests: 2 },
  { code: "twin",     name: "Deluxe Twin Room — AC",             short: "Deluxe twin",     rate: 2800, breakfast: 1100, maxGuests: 2 },
  { code: "superior", name: "Superior Room — AC, triple bed",    short: "Superior room",   rate: 3500, breakfast: 1650, maxGuests: 3 },
  { code: "fourbed",  name: "Deluxe Four-Bed Room — AC",         short: "Deluxe four-bed", rate: 4000, breakfast: 2200, maxGuests: 4 },
  { code: "suite",    name: "Family Suite — king and twin beds", short: "Family suite",    rate: 5500, breakfast: 2200, maxGuests: 4 }
];

/* "Note: extra person @800/-" on the room plan: per extra guest, per night.
   At most this many extra guests in one room. */
export const EXTRA_PERSON = 800;
export const MAX_EXTRA_PER_ROOM = 1;

/* Taxes and charges added on top of the room plan, as fractions (0.13 =
   13%). Zero means the room plan's prices are what the guest pays. Ask the
   hotel before changing: guests pay in full when they book. */
export const SERVICE_CHARGE = 0;
export const VAT = 0;

/* Limits on one online booking. */
export const MAX_NIGHTS = 30;
export const MAX_ROOMS = 5;
export const MAX_DAYS_AHEAD = 365;

/* An unpaid booking holds its rooms this long while the guest pays on
   eSewa (an eSewa session lasts 15 minutes from login). */
export const HOLD_MINUTES = 20;

export const byCode = code => ROOMS.find(r => r.code === code);
export const byName = name => ROOMS.find(r => r.name === name);

/* Dates are plain "YYYY-MM-DD" strings, compared as calendar days. */
const DAY = 86400000;
const parseDay = s => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || "")) return null;
  const t = Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return new Date(t).toISOString().slice(0, 10) === s ? t : null;   /* rejects 2026-02-30 */
};
/* Today in Nepal (UTC+5:45): a guest booking at 1 am on the 5th is booking
   from the 5th, whatever the server's clock says. */
export const todayNepal = (now = Date.now()) => new Date(now + (5 * 60 + 45) * 60000).toISOString().slice(0, 10);

/* Checks a stay and works out its price. Returns { ok: true, ...quote } or
   { ok: false, error } with an error code the page can translate. */
export function quote({ room, checkIn, checkOut, rooms = 1, guests = 1, breakfast = false }, now = Date.now()) {
  const r = typeof room === "string" ? (byCode(room) || byName(room)) : room;
  if (!r) return { ok: false, error: "room" };
  const a = parseDay(checkIn), b = parseDay(checkOut), today = parseDay(todayNepal(now));
  if (a === null || b === null) return { ok: false, error: "dates" };
  if (a < today) return { ok: false, error: "past" };
  if (a > today + MAX_DAYS_AHEAD * DAY) return { ok: false, error: "far" };
  const nights = Math.round((b - a) / DAY);
  if (nights < 1) return { ok: false, error: "dates" };
  if (nights > MAX_NIGHTS) return { ok: false, error: "long" };
  rooms = Number(rooms); guests = Number(guests);
  if (!Number.isInteger(rooms) || rooms < 1 || rooms > MAX_ROOMS) return { ok: false, error: "rooms" };
  if (!Number.isInteger(guests) || guests < 1) return { ok: false, error: "guests" };
  const extra = Math.max(0, guests - rooms * r.maxGuests);
  if (extra > rooms * MAX_EXTRA_PER_ROOM) return { ok: false, error: "capacity" };
  if (guests < rooms) return { ok: false, error: "guests" };   /* every room needs a guest */

  const roomCost = nights * rooms * r.rate;
  const extraCost = nights * extra * EXTRA_PERSON;
  const breakfastCost = breakfast ? nights * rooms * r.breakfast : 0;
  const subtotal = roomCost + extraCost + breakfastCost;
  const service = Math.round(subtotal * SERVICE_CHARGE);
  const vat = Math.round((subtotal + service) * VAT);
  return {
    ok: true, room: r.code, name: r.name, checkIn, checkOut, nights, rooms, guests, extra,
    breakfast: !!breakfast, roomCost, extraCost, breakfastCost, service, vat,
    total: subtotal + service + vat
  };
}

/* Every night of a stay, as "YYYY-MM-DD" (check-in night to the night before check-out). */
export function nightsOf(checkIn, checkOut) {
  const out = [];
  for (let t = parseDay(checkIn); t < parseDay(checkOut); t += DAY) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

export { parseDay };
