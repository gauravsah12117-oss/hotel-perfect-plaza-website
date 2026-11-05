/* The attendance system's tests (npm test runs them with the booking ones).
   Real handlers, real SQL (PGlite, in memory); Telegram is stood in for by
   a fake fetch that keeps every message. */

import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { makeDriver } from "../pglite-driver.mjs";
import { useDriver } from "../../api/_lib/db.js";
import { attendance, dayRecord, nowNepal, wallText, addDays, dayOf, MIN } from "../../api/_lib/attendance.js";
import * as iclock from "../../api/iclock.js";
import attendanceRoute from "../../api/attendance.js";
import telegramRoute from "../../api/telegram.js";
import cronRoute from "../../api/attendance-cron.js";
import { webhookSecret } from "../../api/_lib/telegram.js";
import { asNotification } from "../../api/_lib/push.js";
import webpush from "web-push";
import { createECDH, randomBytes } from "node:crypto";

async function call(route, { method = "GET", query = {}, body, headers = {} } = {}) {
  const req = { method, query, body, headers: { host: "hotel.test", "x-forwarded-proto": "https", ...headers } };
  const res = { statusCode: 200, h: {}, out: "", setHeader(k, v) { this.h[k.toLowerCase()] = v; }, end(s) { this.out = s || ""; } };
  await route(req, res);
  return { status: res.statusCode, json: res.out ? JSON.parse(res.out) : null };
}
const owner = (action, opts = {}) => call(attendanceRoute, { ...opts, query: { action, ...(opts.query || {}) }, headers: { authorization: "Bearer owner-pass" } });

/* the fingerprint machine */
const SN = "CQZ7232460001";
async function machine(op, { method = "GET", query = {}, body } = {}) {
  const url = new URL(`https://hotel.test/api/iclock?op=${op}&SN=${SN}`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const r = await iclock[method](new Request(url, { method, body }));
  return { status: r.status, text: await r.text() };
}
const punch = lines => machine("cdata", { method: "POST", query: { table: "ATTLOG", Stamp: "9999" }, body: lines.map(([pin, at]) => `${pin}\t${at}\t0\t1\t0\t0\t0`).join("\n") + "\n" });

/* Telegram and the phones' push services, stood in for */
let sent = [], pushed = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  if (url.startsWith("https://push.example/")) {
    pushed.push({ url, headers: opts.headers, bytes: opts.body.length });
    return new Response("", { status: url.endsWith("/gone") ? 410 : 201 });
  }
  if (url.startsWith("https://api.telegram.org/")) {
    const method = url.split("/").pop(), b = opts.body ? JSON.parse(opts.body) : {};
    if (method === "sendMessage") sent.push(b);
    if (method === "getMe") return new Response(JSON.stringify({ ok: true, result: { username: "PerfectPlazaBot" } }));
    return new Response(JSON.stringify({ ok: true, result: true }));
  }
  return realFetch(url, opts);
};

const nowText = (minAgo = 0) => wallText(nowNepal() - minAgo * MIN);
const SET = { shift_start: "09:00", shift_end: "18:00", grace: "10", ot_min: "30", ot_multiplier: "1.5" };

before(() => {
  process.env.ATTENDANCE_PASSWORD = "owner-pass";
  process.env.TELEGRAM_BOT_TOKEN = "123:test";
  process.env.CRON_SECRET = "cron-secret";
});
beforeEach(async () => {
  useDriver(await makeDriver(null));
  sent = []; pushed = [];
});

/* a phone's push subscription, as the browser makes it */
const phone = path => ({ endpoint: "https://push.example/" + path,
  keys: { p256dh: createECDH("prime256v1").generateKeys("base64url"), auth: randomBytes(16).toString("base64url") } });

test("app notifications: a phone turns them on, gets every punch, and is forgotten once it uninstalls", async () => {
  const vapid = webpush.generateVAPIDKeys();
  process.env.VAPID_PUBLIC_KEY = vapid.publicKey; process.env.VAPID_PRIVATE_KEY = vapid.privateKey;
  delete process.env.TELEGRAM_BOT_TOKEN;
  try {
    assert.equal((await owner("settings")).json.push.key, vapid.publicKey);
    assert.equal((await owner("push-subscribe", { method: "POST", body: { subscription: phone("father"), name: "Father's phone" } })).status, 200);
    await owner("push-subscribe", { method: "POST", body: { subscription: phone("gone"), name: "Old phone" } });
    assert.equal((await owner("push-subscribe", { method: "POST", body: { subscription: { endpoint: "nope" } } })).status, 400);
    await approvedMachine();
    await owner("staff", { method: "POST", body: { pin: "3", name: "Hari Yadav" } });
    await punch([["3", nowText(1)]]);
    const toFather = pushed.filter(p => p.url.endsWith("/father"));
    assert.equal(toFather.length, 1);
    assert.equal(toFather[0].headers["Content-Encoding"], "aes128gcm");       /* encrypted for that phone only */
    assert.match(toFather[0].headers.Authorization, /^vapid t=/);
    const devices = (await owner("settings")).json.devices;
    assert.deepEqual(devices.map(d => d.name), ["Father's phone"]);           /* the uninstalled one is gone */
    assert.ok(devices[0].last_ok);
  } finally {
    delete process.env.VAPID_PUBLIC_KEY; delete process.env.VAPID_PRIVATE_KEY;
    process.env.TELEGRAM_BOT_TOKEN = "123:test";
  }
});

test("a notification is the message's first line as its title, the rest under it", () => {
  assert.deepEqual(asNotification("✅ <b>Hari &amp; Sons</b> came in at 9:22 AM\nKitchen · ⏰ 22 min late"),
    { title: "✅ Hari & Sons came in at 9:22 AM", body: "Kitchen · ⏰ 22 min late" });
});

async function approvedMachine() {
  await machine("cdata");
  assert.equal((await owner("device", { method: "POST", body: { sn: SN, approved: true } })).status, 200);
}
async function addPhone() {
  const link = await owner("telegram-link", { method: "POST" });
  const code = link.json.link.split("start=")[1];
  return call(telegramRoute, { method: "POST", headers: { "x-telegram-bot-api-secret-token": webhookSecret() },
    body: { message: { chat: { id: 555, type: "private" }, from: { first_name: "Father" }, text: "/start " + code } } });
}

/* ---------------------------------------------------------- the machine */

test("a new machine is told what to send, but its punches wait for approval", async () => {
  const opts = await machine("cdata", { query: { options: "all", pushver: "2.4.1" } });
  assert.match(opts.text, new RegExp(`^GET OPTION FROM: ${SN}`));
  assert.match(opts.text, /Realtime=1/);
  assert.equal((await punch([["1", nowText()]])).status, 403);
  const s = await owner("settings");
  assert.equal(s.json.machines[0].sn, SN);
  assert.equal(s.json.machines[0].approved, false);
  assert.equal((await owner("punches", { query: { from: dayOf(nowNepal() - 86400000), to: dayOf(nowNepal()) } })).json.punches.length, 0);
});

test("approved: punches are stored once, and new staff appear by number", async () => {
  await approvedMachine();
  const a = await punch([["7", nowText(60)], ["8", nowText(50)]]);
  assert.equal(a.text, "OK: 2");
  await punch([["7", nowText(60)]]);                                   /* the machine sends it again */
  const p = await owner("punches", { query: { from: dayOf(nowNepal() - 86400000), to: dayOf(nowNepal()) } });
  assert.equal(p.json.punches.length, 2);
  const staff = (await owner("staff")).json.staff;
  assert.deepEqual(staff.map(s => s.pin), ["7", "8"]);
});

test("someone new joins on their first punch, so the machine's history isn't counted as absences", async () => {
  await approvedMachine();
  await punch([["12", "2026-09-10 09:00:00"], ["12", "2026-09-08 09:00:00"]]);
  const s = (await owner("staff")).json.staff.find(x => x.pin === "12");
  assert.equal(s.joined, "2026-09-08");
  /* enrolled first (joining "today"), then the machine sends their old punches */
  await machine("cdata", { method: "POST", query: { table: "OPERLOG" }, body: "USER PIN=13\tName=Gita\n" });
  await punch([["13", "2026-09-01 09:00:00"]]);
  assert.equal((await owner("staff")).json.staff.find(x => x.pin === "13").joined, "2026-09-01");
});

test("enrolling someone on the machine gives them their name, but doesn't overwrite the owner's", async () => {
  await approvedMachine();
  await owner("staff", { method: "POST", body: { pin: "2", name: "Sita Devi" } });
  await machine("cdata", { method: "POST", query: { table: "OPERLOG", Stamp: "5" }, body: "USER PIN=1\tName=Ram Sah\tPri=0\nUSER PIN=2\tName=SITA\tPri=0\nOPLOG 4\t0\t2026-11-05 09:00:00\t0\t0\t0\t0\n" });
  const staff = (await owner("staff")).json.staff;
  assert.equal(staff.find(s => s.pin === "1").name, "Ram Sah");
  assert.equal(staff.find(s => s.pin === "2").name, "Sita Devi");
});

/* ----------------------------------------------------------- messages */

test("the owner's phone is linked with a one-time code, and strangers are turned away", async () => {
  const r = await addPhone();
  assert.match(r.json.text, /Connected/);
  const s = await owner("settings");
  assert.equal(s.json.chats[0].name, "Father");
  const stranger = await call(telegramRoute, { method: "POST", headers: { "x-telegram-bot-api-secret-token": webhookSecret() },
    body: { message: { chat: { id: 999, type: "private" }, text: "/today" } } });
  assert.match(stranger.json.text, /private/);
  const forged = await call(telegramRoute, { method: "POST", headers: { "x-telegram-bot-api-secret-token": "nope" }, body: {} });
  assert.equal(forged.status, 401);
});

test("arriving and leaving each send a message straight away", async () => {
  await approvedMachine();
  await addPhone();
  await owner("staff", { method: "POST", body: { pin: "3", name: "Hari Yadav", job: "Kitchen" } });
  sent = [];
  await punch([["3", nowText(10)]]);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].chat_id, "555");
  assert.match(sent[0].text, /Hari Yadav<\/b> came in at/);
  assert.match(sent[0].text, /Kitchen/);
  await punch([["3", nowText(9.5)]]);                                  /* pressed twice */
  assert.equal(sent.length, 1);
  await punch([["3", nowText(1)]]);
  assert.equal(sent.length, 2);
  assert.match(sent[1].text, /Hari Yadav<\/b> left at .*\n.*worked 9 min/);
});

test("messages can be in Nepali", async () => {
  await approvedMachine();
  await addPhone();
  await owner("settings", { method: "POST", body: { settings: { lang: "ne" } } });
  await owner("staff", { method: "POST", body: { pin: "4", name: "राम" } });
  sent = [];
  await punch([["4", nowText(1)]]);
  assert.match(sent[0].text, /राम<\/b> .* मा आइपुगे/);
});

test("old punches from a machine that was offline come as one message; its history comes silently", async () => {
  await approvedMachine();
  await addPhone();
  sent = [];
  await punch([["5", nowText(120)], ["6", nowText(100)], ["5", wallText(nowNepal() - 40 * 86400000)]]);
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /offline/);
  assert.equal(sent[0].text.split("•").length - 1, 2);
});

test("the evening summary goes to the phones, and only from Vercel Cron", async () => {
  await addPhone();
  await owner("staff", { method: "POST", body: { pin: "9", name: "Gita", shift_start: "00:30", shift_end: "08:30" } });
  sent = [];
  assert.equal((await call(cronRoute, { headers: { authorization: "Bearer wrong" } })).status, 401);
  const r = await call(cronRoute, { headers: { authorization: "Bearer cron-secret" } });
  assert.equal(r.json.sent, 1);
  assert.match(sent[0].text, /Attendance today/);
});

/* --------------------------------------------------------- the sums */

const staff = (o = {}) => ({ pin: "1", name: "Ram", shift_start: "", shift_end: "", weekly_off: null, salary: 30000, ot_rate: 0, joined: "2026-01-01", ...o });
const ps = (...times) => times.map((at, i) => ({ id: i + 1, t: Date.parse(at.replace(" ", "T") + ":00Z"), source: "machine" }));
const later = Date.parse("2027-01-01T00:00:00Z");

test("a day: late after the grace minutes, overtime once it reaches the minimum", () => {
  const onTime = dayRecord({ staff: staff(), day: "2026-10-01", set: SET, now: later, punches: ps("2026-10-01 09:08", "2026-10-01 18:20") });
  assert.equal(onTime.status, "present");
  assert.equal(onTime.late, 0);
  assert.equal(onTime.ot, 0);                                          /* 12 min extra: under 30 */
  const late = dayRecord({ staff: staff(), day: "2026-10-01", set: SET, now: later, punches: ps("2026-10-01 09:25", "2026-10-01 19:00") });
  assert.equal(late.status, "late");
  assert.equal(late.late, 25);
  assert.equal(late.worked, 575);
  assert.equal(late.ot, 35);
});

test("a day with a break, a forgotten punch-out, and a half day", () => {
  const brk = dayRecord({ staff: staff(), day: "2026-10-01", set: SET, now: later,
    punches: ps("2026-10-01 09:00", "2026-10-01 13:00", "2026-10-01 14:00", "2026-10-01 18:00") });
  assert.equal(brk.worked, 480);
  assert.equal(brk.in, "09:00"); assert.equal(brk.out, "18:00");
  const forgot = dayRecord({ staff: staff(), day: "2026-10-01", set: SET, now: later, punches: ps("2026-10-01 09:00") });
  assert.equal(forgot.missing, true);
  const half = dayRecord({ staff: staff(), day: "2026-10-01", set: SET, now: later, punches: ps("2026-10-01 09:00", "2026-10-01 12:00") });
  assert.equal(half.status, "half");
  assert.equal(half.early, 360);
});

test("a night shift is one day, even across midnight", () => {
  const night = staff({ shift_start: "20:00", shift_end: "08:00" });
  const d = dayRecord({ staff: night, day: "2026-10-01", set: SET, now: later, punches: ps("2026-10-01 19:55", "2026-10-02 08:40") });
  assert.equal(d.worked, 765);
  assert.equal(d.late, 0);
  assert.equal(d.ot, 45);
});

test("someone still at work is shown as in, with their hours so far", () => {
  const now = Date.parse("2026-10-01T12:00:00Z");
  const d = dayRecord({ staff: staff(), day: "2026-10-01", set: SET, now, punches: ps("2026-10-01 09:00") });
  assert.equal(d.inside, true);
  assert.equal(d.worked, 180);
  const waiting = dayRecord({ staff: staff(), day: "2026-10-01", set: SET, now: Date.parse("2026-10-01T08:00:00Z"), punches: [] });
  assert.equal(waiting.status, "upcoming");
  /* a day off, holiday or leave still to come isn't counted yet, but is shown */
  const sat = dayRecord({ staff: staff({ weekly_off: 6 }), day: "2026-10-03", set: SET, now, punches: [], leave: "paid" });
  assert.equal(sat.status, "upcoming");
  assert.equal(sat.off, true);
  assert.equal(sat.leave, "paid");
});

test("a month: absences, leave, holidays, weekly off, overtime and pay", async () => {
  await owner("staff", { method: "POST", body: { pin: "1", name: "Ram", salary: 30000, weekly_off: 6, joined: "2026-01-01" } });
  await owner("holiday", { method: "POST", body: { day: "2026-09-02", name: "Teej" } });
  await owner("leave", { method: "POST", body: { pin: "1", from: "2026-09-03", to: "2026-09-04", kind: "paid" } });
  await owner("leave", { method: "POST", body: { pin: "1", from: "2026-09-07", kind: "unpaid" } });
  /* 1 Sep worked with 2 h overtime; the rest of September not punched */
  for (const t of ["09:00", "20:00"]) assert.equal((await owner("punch", { method: "POST", body: { pin: "1", day: "2026-09-01", time: t, note: "test" } })).status, 200);
  const r = await owner("report", { query: { from: "2026-09-01", to: "2026-09-30" } });
  const s = r.json.staff[0].summary;
  assert.equal(s.days, 30);
  assert.equal(s.present, 1);
  assert.equal(s.holiday, 1);
  assert.equal(s.paidLeave, 2);
  assert.equal(s.unpaidLeave, 1);
  assert.equal(s.off, 4);                                              /* Saturdays 5, 12, 19, 26 */
  assert.equal(s.absent, 30 - 1 - 1 - 2 - 1 - 4);
  assert.equal(s.ot, 120);
  assert.equal(s.dayRate, 1000);
  assert.equal(s.otHourly, Math.round(1000 / 9 * 1.5));
  assert.equal(s.deduction, (s.absent + 1) * 1000);
  assert.equal(s.pay, 30000 - s.deduction + s.otPay);
  assert.equal(s.manual, 1);
});

test("a wrong punch can be left out, and a hand-added one removed", async () => {
  await owner("staff", { method: "POST", body: { pin: "1", name: "Ram" } });
  const a = await owner("punch", { method: "POST", body: { pin: "1", day: "2026-09-01", time: "09:00" } });
  assert.equal((await owner("punch", { method: "POST", body: { pin: "1", day: "2026-09-01", time: "09:00" } })).status, 409);
  await owner("punch-ignore", { method: "POST", body: { id: a.json.id } });
  let r = await attendance("2026-09-01", "2026-09-01");
  assert.equal(r.staff[0].days[0].punches.length, 0);
  assert.equal((await owner("punch-delete", { method: "POST", body: { id: a.json.id } })).status, 200);
  assert.equal((await owner("punch", { method: "POST", body: { pin: "1", day: addDays(dayOf(nowNepal()), 2), time: "09:00" } })).status, 400);
});

test("the owner's page needs the password", async () => {
  assert.equal((await call(attendanceRoute, { query: { action: "today" } })).status, 401);
  const t = await owner("today");
  assert.equal(t.status, 200);
  assert.ok(Array.isArray(t.json.rows));
});
