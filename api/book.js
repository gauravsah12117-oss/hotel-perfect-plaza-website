/* POST /api/book
   { room, checkIn, checkOut, rooms, guests, breakfast, name, email, phone,
     notes, accept, website (a trap for bots: people leave it empty) }
   Holds the rooms for HOLD_MINUTES and returns the signed eSewa form the
   page posts to take the guest to pay:
   { id, total, form: { action, fields } }  or  { error } */

import { quote } from "./_lib/rooms.js";
import { createBooking } from "./_lib/bookings.js";
import { paymentForm } from "./_lib/esewa.js";
import { json, body, handle, only, origin, clean, cleanText } from "./_lib/http.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default handle(async (req, res) => {
  if (!only(req, res, "POST")) return;
  const b = body(req);
  if (b.website) return json(res, 400, { error: "spam" });

  const v = quote({ room: b.room, checkIn: b.checkIn, checkOut: b.checkOut, rooms: b.rooms, guests: b.guests, breakfast: !!b.breakfast });
  if (!v.ok) return json(res, 400, { error: v.error });

  const name = clean(b.name, 120), email = clean(b.email, 200), phone = clean(b.phone, 40), notes = cleanText(b.notes, 1000);
  if (!name) return json(res, 400, { error: "name" });
  if (!EMAIL.test(email)) return json(res, 400, { error: "email" });
  if (phone.replace(/\D/g, "").length < 7) return json(res, 400, { error: "phone" });
  if (b.accept !== true) return json(res, 400, { error: "accept" });

  const made = await createBooking({ ...v, name, email, phone, notes, status: "pending", source: "web" });
  if (made.error) return json(res, 409, { error: "full" });

  const site = origin(req);
  const form = paymentForm({
    total: v.total, uuid: made.uuid,
    successUrl: site + "/booking.html",
    failureUrl: site + "/booking.html?failed=" + encodeURIComponent(made.uuid)
  });
  json(res, 200, { id: made.id, total: v.total, nights: v.nights, form: { action: form.action, fields: form.fields }, payment: form.mode });
});
