/* The booking system's tests:  npm test
   Real handlers, real SQL (PGlite, in memory); eSewa's status check and the
   email service are stood in for by a fake fetch. */

import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { makeDriver } from "../pglite-driver.mjs";
import { useDriver } from "../../api/_lib/db.js";
import { quote, todayNepal } from "../../api/_lib/rooms.js";
import { sign, readSuccessData, paymentForm } from "../../api/_lib/esewa.js";
import availabilityRoute from "../../api/availability.js";
import bookRoute from "../../api/book.js";
import verifyRoute from "../../api/esewa-verify.js";
import failedRoute from "../../api/esewa-failed.js";
import adminRoute from "../../api/admin.js";

let driver;
const day = n => new Date(Date.parse(todayNepal() + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);

/* ------------------------------------------------ calling a route directly */
async function call(route, { method = "GET", query = {}, body, headers = {} } = {}) {
  const req = { method, query, body, headers: { host: "hotel.test", "x-forwarded-proto": "https", ...headers } };
  const res = {
    statusCode: 200, h: {}, out: "",
    setHeader(k, v) { this.h[k.toLowerCase()] = v; },
    end(s) { this.out = s || ""; }
  };
  await route(req, res);
  return { status: res.statusCode, json: res.out ? JSON.parse(res.out) : null };
}
const admin = (opts) => call(adminRoute, { ...opts, headers: { authorization: "Bearer secret-pass" } });

/* ------------------------------------------ eSewa and Resend, stood in for */
let esewa = {};          /* uuid → "COMPLETE" | "PENDING" | ... */
let emails = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  if (url.startsWith("https://rc.esewa.com.np/api/epay/transaction/status/")) {
    const p = new URL(url).searchParams;
    const status = esewa[p.get("transaction_uuid")] || "NOT_FOUND";
    return new Response(JSON.stringify({ product_code: p.get("product_code"), transaction_uuid: p.get("transaction_uuid"),
      total_amount: Number(p.get("total_amount")), status, ref_id: status === "COMPLETE" ? "0TEST1" : null }));
  }
  if (url === "https://api.resend.com/emails") { emails.push(JSON.parse(opts.body)); return new Response('{"id":"x"}'); }
  return realFetch(url, opts);
};

/* eSewa's success redirect data, signed the way eSewa signs it */
function successData(uuid, total) {
  const d = { transaction_code: "0TEST1", status: "COMPLETE", total_amount: total.toLocaleString("en-US") + ".0", transaction_uuid: uuid,
    product_code: "EPAYTEST", signed_field_names: "transaction_code,status,total_amount,transaction_uuid,product_code,signed_field_names" };
  d.signature = sign(d, d.signed_field_names.split(","), "8gBm/:&EnhH.1/q");
  return Buffer.from(JSON.stringify(d)).toString("base64");
}

const guest = { name: "Sita Sharma", email: "sita@example.com", phone: "9800000000", accept: true };
const book = extra => call(bookRoute, { method: "POST", body: { room: "deluxe", checkIn: day(10), checkOut: day(12), rooms: 1, guests: 2, ...guest, ...extra } });

before(async () => {
  process.env.ADMIN_PASSWORD = "secret-pass";
  process.env.RESEND_API_KEY = "test-key";
  delete process.env.ESEWA_MODE;
});
beforeEach(async () => {
  driver = await makeDriver(null);
  useDriver(driver);
  esewa = {}; emails = [];
  await admin({ method: "POST", query: { action: "rooms" }, body: { counts: { deluxe: 1, twin: 2, suite: 1 } } });
});

/* ------------------------------------------------------------------ prices */

test("prices follow the room plan", () => {
  const q = o => quote({ checkIn: day(5), checkOut: day(7), ...o });
  assert.equal(q({ room: "single", guests: 1 }).total, 2 * 1500);
  assert.equal(q({ room: "deluxe", guests: 2 }).total, 2 * 2500);
  assert.equal(q({ room: "twin", guests: 2, breakfast: true }).total, 2 * (2800 + 1100));
  assert.equal(q({ room: "superior", guests: 3, breakfast: true }).total, 2 * (3500 + 1650));
  assert.equal(q({ room: "fourbed", guests: 5 }).total, 2 * (4000 + 800));          /* one extra person */
  assert.equal(q({ room: "suite", guests: 4, breakfast: true }).total, 2 * (5500 + 2200));
  assert.equal(q({ room: "deluxe", rooms: 2, guests: 4 }).total, 2 * 2 * 2500);
  assert.equal(q({ room: "Family Suite — king and twin beds", guests: 2 }).room, "suite");   /* by its form name too */
});

test("impossible stays are refused", () => {
  const q = o => quote({ room: "deluxe", checkIn: day(5), checkOut: day(7), guests: 2, ...o }).error;
  assert.equal(q({ guests: 4 }), "capacity");                 /* 2 + 1 extra is the most */
  assert.equal(q({ room: "nope" }), "room");
  assert.equal(q({ checkIn: day(-1), checkOut: day(1) }), "past");
  assert.equal(q({ checkOut: day(5) }), "dates");
  assert.equal(q({ checkIn: "2026-02-30" }), "dates");
  assert.equal(q({ checkOut: day(40) }), "long");
  assert.equal(q({ rooms: 0 }), "rooms");
});

/* ------------------------------------------------------------------- eSewa */

test("eSewa's signed reply is accepted, and a tampered one is not", () => {
  const data = successData("HPP-ABC-1", 5000);
  assert.equal(readSuccessData(data).transaction_uuid, "HPP-ABC-1");
  const obj = JSON.parse(Buffer.from(data, "base64").toString());
  obj.total_amount = "1.0";
  assert.equal(readSuccessData(Buffer.from(JSON.stringify(obj)).toString("base64")), null);
  assert.equal(readSuccessData("not base64 json"), null);
});

test("the payment form is signed over total, id and product code", () => {
  const f = paymentForm({ total: 5000, uuid: "HPP-X-1", successUrl: "https://a/ok", failureUrl: "https://a/no" }).fields;
  assert.equal(f.signature, sign(f, ["total_amount", "transaction_uuid", "product_code"], "8gBm/:&EnhH.1/q"));
  assert.equal(f.total_amount, "5000");
  assert.equal(f.product_code, "EPAYTEST");
});

/* ------------------------------------------------------------ availability */

test("availability counts paid, blocked and fresh pending bookings", async () => {
  let a = await call(availabilityRoute, { query: { in: day(10), out: day(12) } });
  assert.equal(a.json.rooms.find(r => r.code === "twin").left, 2);
  assert.equal(a.json.rooms.find(r => r.code === "single").left, 0);   /* not set up: none online */

  const b = await book({ room: "twin" });
  assert.equal(b.status, 200);
  assert.equal(b.json.total, 2 * 2800);
  assert.match(b.json.form.fields.success_url, /^https:\/\/hotel\.test\/booking\.html$/);
  a = await call(availabilityRoute, { query: { in: day(11), out: day(13) } });
  assert.equal(a.json.rooms.find(r => r.code === "twin").left, 1, "overlapping night is taken");
  a = await call(availabilityRoute, { query: { in: day(12), out: day(14) } });
  assert.equal(a.json.rooms.find(r => r.code === "twin").left, 2, "check-out day is free again");
});

test("the last room goes to exactly one guest, even at the same moment", async () => {
  const [a, b] = await Promise.all([book(), book({ email: "ram@example.com" })]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  assert.equal((await book({ checkIn: day(11), checkOut: day(13) })).json.error, "full");
});

test("an unpaid hold runs out, and leaving eSewa frees it at once", async () => {
  const a = await book();
  await driver.query(`UPDATE bookings SET created_at = now() - interval '25 minutes'`);
  assert.equal((await book()).status, 200, "expired hold no longer counts");

  await driver.query(`DELETE FROM bookings`);
  const c = await book();
  await call(failedRoute, { method: "POST", body: { t: c.json.form.fields.transaction_uuid } });
  assert.equal((await book()).status, 200, "failed payment frees the room");
});

/* -------------------------------------------------------------- payment */

test("a payment is confirmed with eSewa, and emails go out once", async () => {
  const b = await book({ breakfast: true });
  const uuid = b.json.form.fields.transaction_uuid;
  esewa[uuid] = "COMPLETE";
  const v = await call(verifyRoute, { query: { data: successData(uuid, b.json.total) } });
  assert.equal(v.json.state, "paid");
  assert.equal(v.json.booking.esewaRef, "0TEST1");
  assert.equal(v.json.booking.amount, 2 * (2500 + 1100));
  assert.equal(emails.length, 2);
  assert.deepEqual(emails.map(e => e.to[0]).sort(), ["hotelperfectplaza@gmail.com", "sita@example.com"]);

  const again = await call(verifyRoute, { query: { data: successData(uuid, b.json.total) } });
  assert.equal(again.json.state, "paid");
  assert.equal(emails.length, 2, "a reload does not email again");
});

test("the redirect alone is not proof: eSewa must say COMPLETE", async () => {
  const b = await book();
  const uuid = b.json.form.fields.transaction_uuid;
  esewa[uuid] = "PENDING";
  let v = await call(verifyRoute, { query: { data: successData(uuid, b.json.total) } });
  assert.equal(v.status, 202);
  assert.equal(v.json.state, "pending");
  esewa[uuid] = "NOT_FOUND";
  v = await call(verifyRoute, { query: { t: uuid } });
  assert.equal(v.json.state, "failed");
  assert.equal(emails.length, 0);
});

test("a forged reply is refused", async () => {
  const b = await book();
  const uuid = b.json.form.fields.transaction_uuid;
  const obj = JSON.parse(Buffer.from(successData(uuid, b.json.total), "base64").toString());
  obj.signature = "AAAA" + obj.signature.slice(4);
  const v = await call(verifyRoute, { query: { data: Buffer.from(JSON.stringify(obj)).toString("base64") } });
  assert.equal(v.status, 400);
});

test("paid after the hold ran out and the room was sold: flagged, not lost", async () => {
  const a = await book();
  const uuidA = a.json.form.fields.transaction_uuid;
  await driver.query(`UPDATE bookings SET created_at = now() - interval '25 minutes'`);
  const b = await book({ email: "ram@example.com" });
  const uuidB = b.json.form.fields.transaction_uuid;
  esewa[uuidB] = "COMPLETE"; esewa[uuidA] = "COMPLETE";
  assert.equal((await call(verifyRoute, { query: { t: uuidB } })).json.state, "paid");
  assert.equal((await call(verifyRoute, { query: { t: uuidA } })).json.state, "conflict");
  assert.ok(emails.some(e => /OVERBOOKED/.test(e.subject)));
});

test("a late payment still counts when the room is still free", async () => {
  const a = await book();
  await driver.query(`UPDATE bookings SET created_at = now() - interval '25 minutes'`);
  esewa[a.json.form.fields.transaction_uuid] = "COMPLETE";
  assert.equal((await call(verifyRoute, { query: { t: a.json.form.fields.transaction_uuid } })).json.state, "paid");
});

test("bookings need a name, a real email, a phone and the policy accepted", async () => {
  assert.equal((await book({ name: "" })).json.error, "name");
  assert.equal((await book({ email: "nope" })).json.error, "email");
  assert.equal((await book({ phone: "12" })).json.error, "phone");
  assert.equal((await book({ accept: false })).json.error, "accept");
  assert.equal((await book({ website: "http://spam" })).json.error, "spam");
});

/* ------------------------------------------------------------------ admin */

test("admin: password, walk-in blocks, the grid, cancelling", async () => {
  assert.equal((await call(adminRoute, { query: { action: "rooms" }, headers: { authorization: "Bearer wrong" } })).status, 401);

  const blk = await admin({ method: "POST", query: { action: "block" }, body: { room: "deluxe", checkIn: day(10), checkOut: day(11), name: "Walk-in" } });
  assert.equal(blk.status, 200);
  assert.equal((await book()).json.error, "full", "a staff block takes the room");

  const full = await admin({ method: "POST", query: { action: "block" }, body: { room: "deluxe", checkIn: day(10), checkOut: day(11) } });
  assert.equal(full.status, 409);
  assert.equal((await admin({ method: "POST", query: { action: "block" }, body: { room: "deluxe", checkIn: day(10), checkOut: day(11), force: true } })).status, 200);

  const grid = await admin({ query: { action: "grid", from: day(9), days: 4 } });
  assert.deepEqual(grid.json.rooms.find(r => r.code === "deluxe").left, [1, -1, 1, 1]);

  const list = await admin({ query: { action: "bookings", from: day(0), to: day(30) } });
  assert.equal(list.json.bookings.length, 2);
  for (const bk of list.json.bookings) assert.equal((await admin({ method: "POST", query: { action: "cancel" }, body: { id: bk.id } })).status, 200);
  assert.equal((await book()).status, 200, "cancelled blocks free the room");
});
