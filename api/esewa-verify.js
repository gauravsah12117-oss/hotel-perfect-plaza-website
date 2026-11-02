/* GET /api/esewa-verify?data=<eSewa's base64 reply>   (or ?t=<transaction_uuid>)
   Called by booking.html when eSewa sends the guest back. The redirect
   alone proves nothing — anyone can type an address — so the payment is
   always confirmed with eSewa's own status check, for the amount the
   booking was made for, before the booking counts as paid. Then the hotel
   and the guest are emailed, once.

   Replies { state: "paid" | "conflict" | "pending" | "failed", booking } */

import { readSuccessData, checkStatus } from "./_lib/esewa.js";
import { byUuid, confirmPayment, claimEmail, markFailed } from "./_lib/bookings.js";
import { sendBookingEmails } from "./_lib/mail.js";
import { byCode } from "./_lib/rooms.js";
import { json, handle, only } from "./_lib/http.js";

/* What the guest's page may see: no other guest's details, nothing internal. */
const publicView = b => ({
  id: b.id, room: b.room_code, roomName: (byCode(b.room_code) || {}).name || b.room_code, rooms: b.rooms,
  checkIn: b.check_in, checkOut: b.check_out, guests: b.guests, breakfast: b.breakfast,
  amount: b.amount, name: b.name, email: b.email, phone: b.phone, esewaRef: b.esewa_ref, status: b.status
});

const stateOf = s => s === "paid" ? "paid" : s === "paid_conflict" ? "conflict" : s === "pending" ? "pending" : "failed";

export default handle(async (req, res) => {
  if (!only(req, res, "GET")) return;

  let uuid = null;
  if (req.query.data) {
    const d = readSuccessData(req.query.data);
    if (!d) return json(res, 400, { error: "signature" });
    uuid = String(d.transaction_uuid);
  } else if (req.query.t) {
    uuid = String(req.query.t);
  }
  if (!uuid) return json(res, 400, { error: "missing" });

  let b = await byUuid(uuid);
  if (!b) return json(res, 404, { error: "unknown" });

  if (b.status === "pending" || b.status === "failed") {
    const s = await checkStatus({ uuid, total: b.amount });
    if (s.status === "COMPLETE") {
      b = await confirmPayment(b, s.ref);
    } else if (["NOT_FOUND", "CANCELED", "FULL_REFUND"].includes(s.status)) {
      await markFailed(uuid);
      b = await byUuid(uuid);
    } else {
      /* PENDING, AMBIGUOUS, or eSewa not answering: ask again shortly */
      return json(res, 202, { state: "pending", booking: publicView(b) });
    }
  }

  if ((b.status === "paid" || b.status === "paid_conflict") && await claimEmail(b.id)) {
    await sendBookingEmails(b);
  }
  json(res, 200, { state: stateOf(b.status), booking: publicView(b) });
});
