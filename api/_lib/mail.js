/* ==========================================================================
   Booking emails, sent through Resend (resend.com, free up to 3,000 a month).
   --------------------------------------------------------------------------
   RESEND_API_KEY   the API key from resend.com
   MAIL_FROM        e.g. "Hotel Perfect Plaza <bookings@hotelperfectplaza.com>"
                    — the domain must be verified in Resend (it gives DNS
                    records to add). Until then Resend only delivers to the
                    Resend account's own address, so the guest's copy fails.
   HOTEL_EMAIL      where bookings go (default hotelperfectplaza@gmail.com)

   No key, no emails: the booking still works and shows on admin.html.
   ========================================================================== */

import { byCode } from "./rooms.js";

const HOTEL = {
  name: "Hotel Perfect Plaza",
  phone: "+977-41-590911",
  mobiles: "9854022215, 9844022215",
  whatsapp: "9779854022215",
  address: "Ramanand Chowk-9, Janakpurdham, Dhanusha, Nepal"
};

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const npr = n => "NPR " + Number(n).toLocaleString("en-US");
const nice = d => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/* The booking's lines, shared by both emails and the WhatsApp message. */
export function lines(b) {
  const r = byCode(b.room_code);
  const nights = Math.round((Date.parse(b.check_out) - Date.parse(b.check_in)) / 86400000);
  return [
    ["Booking", b.id],
    ["Room", (b.rooms > 1 ? b.rooms + " × " : "") + (r ? r.name : b.room_code)],
    ["Check-in", nice(b.check_in) + " (from 14:00)"],
    ["Check-out", nice(b.check_out) + " (by 12:00)"],
    ["Nights", String(nights)],
    ["Guests", String(b.guests)],
    ["Breakfast", b.breakfast ? "Included" : "Not included"],
    ["Paid", npr(b.amount) + " by eSewa" + (b.esewa_ref ? " (ref " + b.esewa_ref + ")" : "")],
    ["Name", b.name], ["Email", b.email], ["Phone", b.phone],
    ...(b.notes ? [["Notes", b.notes]] : [])
  ];
}

function table(rows) {
  return `<table cellpadding="6" style="border-collapse:collapse;font:15px/1.5 Arial,sans-serif;color:#1F1B17">` +
    rows.map(([k, v]) => `<tr><td style="color:#6B6258;padding-right:18px;vertical-align:top">${esc(k)}</td><td><b>${esc(v)}</b></td></tr>`).join("") +
    `</table>`;
}

async function send({ to, subject, html, text, replyTo }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.warn("RESEND_API_KEY not set: email not sent:", subject); return { skipped: true }; }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || "Hotel Perfect Plaza <onboarding@resend.dev>",
      to: [to], subject, html, text, ...(replyTo ? { reply_to: replyTo } : {})
    }),
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) throw new Error("Resend " + res.status + ": " + (await res.text()).slice(0, 300));
  return res.json();
}

/* Both emails for a paid booking. Never throws: an email failure must not
   make a paid booking look failed. Returns what happened, for the log. */
export async function sendBookingEmails(b) {
  const rows = lines(b);
  const hotelTo = process.env.HOTEL_EMAIL || "hotelperfectplaza@gmail.com";
  const conflict = b.status === "paid_conflict";
  const results = {};

  const hotelHead = conflict
    ? `<p style="font:bold 16px Arial;color:#A3261B">⚠ PAID BUT OVERBOOKED — the guest's 20-minute hold ran out before they finished paying, and the room type was full by then. Please call the guest to arrange a room or refund through the eSewa merchant portal.</p>`
    : `<p style="font:16px Arial">New booking, paid in full through eSewa.</p>`;
  try {
    results.hotel = await send({
      to: hotelTo, replyTo: b.email,
      subject: (conflict ? "⚠ OVERBOOKED — " : "New booking ") + b.id + " — " + b.name + ", " + b.check_in,
      html: hotelHead + table(rows) + `<p style="font:13px Arial;color:#6B6258">All bookings: /admin.html on the website.</p>`,
      text: (conflict ? "PAID BUT OVERBOOKED - call the guest.\n\n" : "New booking, paid through eSewa.\n\n") + rows.map(([k, v]) => k + ": " + v).join("\n")
    });
  } catch (e) { results.hotel = { error: String(e.message || e) }; console.error("hotel email failed", e); }

  if (b.email) {
    const guestHead = conflict
      ? `<p>Thank you, ${esc(b.name)}. Your payment reached us, and our front desk will call you shortly to confirm your room.</p>`
      : `<p>Thank you, ${esc(b.name)}. Your room is booked and paid. We look forward to welcoming you to Janakpurdham.</p>`;
    try {
      results.guest = await send({
        to: b.email, replyTo: hotelTo,
        subject: "Your booking at Hotel Perfect Plaza — " + b.id,
        html: `<div style="font:15px/1.6 Arial,sans-serif;color:#1F1B17">${guestHead}${table(rows)}
          <p>To change or cancel, call <b>${HOTEL.phone}</b> or ${HOTEL.mobiles}, or WhatsApp <a href="https://wa.me/${HOTEL.whatsapp}">${HOTEL.whatsapp.replace(/^977/, "")}</a>, with your booking number.</p>
          <p style="color:#6B6258">${HOTEL.name}, ${HOTEL.address}</p></div>`,
        text: (conflict ? "Your payment reached us; our front desk will call you shortly to confirm your room.\n\n" : "Your room is booked and paid.\n\n") +
          rows.map(([k, v]) => k + ": " + v).join("\n") + "\n\nTo change or cancel: " + HOTEL.phone + " / WhatsApp " + HOTEL.whatsapp
      });
    } catch (e) { results.guest = { error: String(e.message || e) }; console.error("guest email failed", e); }
  }
  return results;
}
