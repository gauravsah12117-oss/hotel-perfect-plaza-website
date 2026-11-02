/* Makes a booking on the local server and writes dev/.data/pay.html, a page
   that posts its eSewa form — for dev/esewa-pay.mjs.
     node dev/new-booking.mjs [room] [daysAhead] [nights] */
import { writeFileSync, mkdirSync } from "node:fs";
const [room = "deluxe", ahead = "5", nights = "1"] = process.argv.slice(2);
const d = n => new Date(Date.now() + n * 86400000 + 345 * 60000).toISOString().slice(0, 10);
const res = await fetch((process.env.SITE || "http://localhost:3000") + "/api/book", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ room, checkIn: d(+ahead), checkOut: d(+ahead + +nights), rooms: 1, guests: 2, breakfast: true,
    name: "Test Guest", email: "test@example.com", phone: "9800000000", accept: true })
});
const j = await res.json();
if (!res.ok) { console.log("booking refused:", res.status, j); process.exit(1); }
const esc = s => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
mkdirSync("dev/.data", { recursive: true });
writeFileSync("dev/.data/pay.html", `<!doctype html><form id=f method=POST action="${j.form.action}">` +
  Object.entries(j.form.fields).map(([k, v]) => `<input type=hidden name="${k}" value="${esc(v)}">`).join("") +
  `</form><script>sessionStorage.setItem("hpp-booking", ${JSON.stringify(JSON.stringify({ id: j.id, t: j.form.fields.transaction_uuid }))});document.getElementById("f").submit()</script>`);
console.log("booking", j.id, "total", j.total, "uuid", j.form.fields.transaction_uuid);

/* the address eSewa would send the guest back to after paying, signed with
   eSewa's public TEST key (for ESEWA_FAKE testing) */
const { sign } = await import("../api/_lib/esewa.js");
const back = { transaction_code: "0FAKE01", status: "COMPLETE", total_amount: j.total.toLocaleString("en-US") + ".0",
  transaction_uuid: j.form.fields.transaction_uuid, product_code: "EPAYTEST",
  signed_field_names: "transaction_code,status,total_amount,transaction_uuid,product_code,signed_field_names" };
back.signature = sign(back, back.signed_field_names.split(","), "8gBm/:&EnhH.1/q");
writeFileSync("dev/.data/success-url.txt", "/booking.html?data=" + encodeURIComponent(Buffer.from(JSON.stringify(back)).toString("base64")));
writeFileSync("dev/.data/failure-url.txt", "/booking.html?failed=" + j.form.fields.transaction_uuid);
