/* The attendance system's tests (npm test runs them with the booking ones).
   Real handlers, real SQL (PGlite, in memory); Telegram is stood in for by
   a fake fetch that keeps every message. */

import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { makeDriver } from "../pglite-driver.mjs";
import { useDriver } from "../../api/_lib/db.js";
import { attendance, dayRecord, nowNepal, wallText, addDays, dayOf, MIN } from "../../api/_lib/attendance.js";
import * as iclock from "../../api/iclock.js";
import * as hikRoute from "../../api/hik.js";
import { nepalTime as hikTime } from "../../api/hik.js";
import attendanceRoute from "../../api/attendance.js";
import telegramRoute from "../../api/telegram.js";
import cronRoute from "../../api/attendance-cron.js";
import { webhookSecret } from "../../api/_lib/telegram.js";
import { asNotification } from "../../api/_lib/push.js";
import { date as nepDate } from "../../api/_lib/att-text.js";
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

test("signing in gives a pass the phone keeps instead of the password; a new password signs every phone out", async () => {
  const pass = (await owner("login", { method: "POST" })).json.token;
  assert.match(pass, /^v1\./);
  const withPass = () => call(attendanceRoute, { query: { action: "staff" }, headers: { authorization: "Bearer " + pass } });
  assert.equal((await withPass()).status, 200);
  assert.equal((await call(attendanceRoute, { query: { action: "staff" }, headers: { authorization: "Bearer " + pass.slice(0, -2) + "xx" } })).status, 401);
  process.env.ATTENDANCE_PASSWORD = "a-new-password";
  try { assert.equal((await withPass()).status, 401); }
  finally { process.env.ATTENDANCE_PASSWORD = "owner-pass"; }
});

test("five wrong passwords lock that address out for 15 minutes, even with the right one", async () => {
  const from = ip => ({ "x-forwarded-for": ip });
  const tryPw = (pw, ip) => call(attendanceRoute, { query: { action: "staff" }, headers: { authorization: "Bearer " + pw, ...from(ip) } });
  for (let i = 0; i < 4; i++) assert.equal((await tryPw("guess" + i, "1.2.3.4")).status, 401);
  assert.equal((await tryPw("owner-pass", "1.2.3.4")).status, 200);          /* right before the fifth: clears the count */
  for (let i = 0; i < 5; i++) await tryPw("guess" + i, "1.2.3.4");
  const locked = await tryPw("owner-pass", "1.2.3.4");
  assert.equal(locked.status, 429);
  assert.equal(locked.json.minutes, 15);
  assert.equal((await tryPw("owner-pass", "5.6.7.8")).status, 200);          /* another address isn't affected */
});

test("the backup has everyone, their leave and holidays, and the year's punches", async () => {
  await owner("staff", { method: "POST", body: { pin: "1", name: "Ram", salary: 20000 } });
  await owner("punch", { method: "POST", body: { pin: "1", day: "2026-09-01", time: "09:00", note: "forgot" } });
  await owner("holiday", { method: "POST", body: { day: "2026-10-20", name: "Dashain" } });
  const b = (await owner("backup", { query: { year: "2026" } })).json;
  assert.equal(b.staff[0].name, "Ram");
  assert.deepEqual(b.punches, [["1", "2026-09-01 09:00:00", "manual", 0, "forgot"]]);
  assert.equal(b.holidays[0].name, "Dashain");
  assert.deepEqual(b.years, [2026]);
});

test("a stray first punch after the shift ended isn't counted as hours late", () => {
  const d = dayRecord({ staff: staff(), day: "2026-10-01", set: SET, now: later, punches: ps("2026-10-02 00:33") });
  assert.equal(d.late, 0);
  assert.equal(d.missing, true);
});

test("the Nepali calendar: known dates, every day there and back, and the summary's date", () => {
  const ND = globalThis.NepaliDate;
  const known = { "2018-04-14": [2075, 1, 1], "2024-04-13": [2081, 1, 1], "2025-04-14": [2082, 1, 1], "2026-04-14": [2083, 1, 1], "2026-11-05": [2083, 7, 19] };
  for (const [ad, [y, m, d]] of Object.entries(known)) {
    assert.deepEqual(ND.toBS(ad), { y, m, d }, ad);
    assert.equal(ND.toAD(y, m, d), ad);
  }
  for (let t = Date.parse("2018-04-14"), prev = null; t < Date.parse("2034-04-01"); t += 86400000) {
    const ad = new Date(t).toISOString().slice(0, 10), b = ND.toBS(ad);
    assert.equal(ND.toAD(b.y, b.m, b.d), ad);
    if (prev) assert.ok(b.d === prev.d + 1 || (b.d === 1 && (b.m === prev.m + 1 || (b.m === 1 && b.y === prev.y + 1))), ad);
    prev = b;
  }
  assert.equal(ND.toBS("2017-01-01"), null);                               /* before the table: English dates */
  assert.equal(nepDate("2026-11-05", "en"), "Thu 5 Nov (19 Kartik 2083)");
  assert.equal(nepDate("2026-11-05", "ne"), "बिहीबार, कात्तिक १९, २०८३");
});

/* ------------------------------------------------- a Hikvision terminal */
const MAC = "c0:56:e3:aa:bb:cc";
const hikEvent = (pin, at, extra = {}) => ({ ipAddress: "192.168.1.64", macAddress: MAC, dateTime: at, eventType: "AccessControllerEvent",
  AccessControllerEvent: { deviceName: "Access Controller", majorEventType: 5, subEventType: 38, employeeNoString: pin, ...extra } });
const hik = (body, type = "application/json") => hikRoute.POST(new Request("https://hotel.test/api/hik", { method: "POST", body, headers: { "content-type": type } }));
const nepalIso = minAgo => new Date(Date.now() - minAgo * MIN).toISOString().slice(0, 19) + "Z";

test("Hikvision: JSON, multipart with a face photo, and XML; kept only once approved", async () => {
  await addPhone();
  await hik(JSON.stringify(hikEvent("21", nepalIso(2))));                   /* not approved yet: not kept */
  const sn = "HIK-" + MAC.toUpperCase();
  assert.equal((await owner("settings")).json.machines[0].sn, sn);
  assert.equal((await owner("staff")).json.staff.length, 0);
  await owner("device", { method: "POST", body: { sn, approved: true } });
  sent = [];
  const boundary = "MIME_boundary";
  const multipart = `--${boundary}\r\nContent-Disposition: form-data; name="event_log"\r\nContent-Type: application/json\r\n\r\n` +
    JSON.stringify(hikEvent("21", nepalIso(1))) + `\r\n--${boundary}\r\nContent-Disposition: form-data; name="Picture"; filename="face.jpg"\r\nContent-Type: image/jpeg\r\n\r\n\xff\xd8\xff\xe0JPEGDATA\r\n--${boundary}--\r\n`;
  assert.equal((await hik(multipart, `multipart/form-data; boundary=${boundary}`)).status, 200);
  const xml = `<?xml version="1.0"?><EventNotificationAlert><ipAddress>192.168.1.64</ipAddress><macAddress>${MAC}</macAddress>` +
    `<dateTime>${addDays(dayOf(nowNepal()), -3)}T09:05:00+05:45</dateTime><eventType>AccessControllerEvent</eventType><AccessControllerEvent>` +
    `<employeeNoString>22</employeeNoString><subEventType>75</subEventType></AccessControllerEvent></EventNotificationAlert>`;
  await hik(xml, "application/xml");
  await hik(JSON.stringify({ macAddress: MAC, eventType: "heartBeat", dateTime: nepalIso(0) }));      /* only "seen" */
  await hik(JSON.stringify(hikEvent("", nepalIso(0), { subEventType: 39 })));                          /* a finger not recognised */
  const p = (await owner("punches", { query: { from: addDays(dayOf(nowNepal()), -3), to: dayOf(nowNepal()) } })).json.punches;
  assert.equal(p.length, 2);
  assert.deepEqual(p.map(x => x.pin).sort(), ["21", "22"]);
  assert.equal(p.find(x => x.pin === "22").at, addDays(dayOf(nowNepal()), -3) + " 09:05:00");        /* the terminal's time, in Nepal time */
  assert.equal(p.find(x => x.pin === "22").verify, 15);                        /* face */
  assert.equal(sent.length, 1);                                                /* a notification for the punch just now */
  assert.match(sent[0].text, /came in at/);
});

test("Hikvision times: with a time zone they are exact, without one the terminal's clock is taken as Nepal time", () => {
  assert.equal(hikTime("2026-11-05T03:17:07Z"), "2026-11-05 09:02:07");
  assert.equal(hikTime("2026-11-05T09:02:07+05:45"), "2026-11-05 09:02:07");
  assert.equal(hikTime("2026-11-05T09:02:07"), "2026-11-05 09:02:07");
  assert.equal(hikTime("nonsense"), null);
});

/* ------------------------------------------------------------ the roster */
test("the roster: a rostered night shift and day off are what lateness, overtime and absence follow", async () => {
  await owner("staff", { method: "POST", body: { pin: "1", name: "Ram", joined: "2026-01-01" } });       /* usually 09:00–18:00 */
  /* Tue 1 Sep: night 22:00–06:00; Wed 2 Sep: off; Thu 3 Sep: usual */
  await owner("roster", { method: "POST", body: { pin: "1", day: "2026-09-01", shift: { name: "Night", start: "22:00", end: "06:00" } } });
  await owner("roster", { method: "POST", body: { pin: "1", day: "2026-09-02", shift: "off" } });
  for (const [d, t] of [["2026-09-01", "22:20"], ["2026-09-02", "06:45"], ["2026-09-03", "09:00"], ["2026-09-03", "18:00"]])
    await owner("punch", { method: "POST", body: { pin: "1", day: d, time: t } });
  const days = (await owner("report", { query: { from: "2026-09-01", to: "2026-09-03" } })).json.staff[0].days;
  assert.equal(days[0].shiftStart, "22:00");
  assert.equal(days[0].late, 20);
  assert.equal(days[0].out, "06:45");                                          /* the next morning, same night */
  assert.equal(days[0].worked, 505);
  assert.equal(days[0].ot, 0);                                                 /* 25 minutes extra: under 30 */
  assert.equal(days[1].status, "off");
  assert.equal(days[2].status, "present");
  assert.equal(days[2].late, 0);
  /* "copy last week": the week of Sun 30 Aug copied into the week of Sun 6 Sep */
  await owner("roster-copy", { method: "POST", body: { from: "2026-09-06" } });
  const next = (await owner("roster", { query: { from: "2026-09-06" } })).json.entries;
  assert.deepEqual(next.map(e => [e.day, e.off ? "off" : e.start]).sort(), [["2026-09-08", "22:00"], ["2026-09-09", "off"]]);
  await owner("roster", { method: "POST", body: { pin: "1", day: "2026-09-09", shift: null } });   /* back to usual */
  assert.equal((await owner("roster", { query: { from: "2026-09-06" } })).json.entries.length, 1);
});

/* -------------------------------------------------------------- payslips */
test("payslips: bonus and allowance added, SSF, advance, tax and deductions taken off", async () => {
  await owner("staff", { method: "POST", body: { pin: "1", name: "Ram", salary: 30000, joined: "2026-01-01", ssf: true } });
  for (let d = 1; d <= 30; d++) {
    const day = `2026-09-${String(d).padStart(2, "0")}`;
    if (d === 15) continue;                                                     /* one day absent */
    for (const t of ["09:00", "18:00"]) await owner("punch", { method: "POST", body: { pin: "1", day, time: t } });
  }
  const add = (kind, amount, day = "2026-09-10") => owner("adjust", { method: "POST", body: { pin: "1", day, kind, amount, note: kind } });
  await add("advance", 5000); await add("bonus", 1000); await add("allowance", 500); await add("tax", 300); await add("deduction", 200);
  await add("advance", 9999, "2026-10-02");                                    /* next month: not on this payslip */
  assert.equal((await add("salary", 100)).status, 400);
  const s = (await owner("report", { query: { from: "2026-09-01", to: "2026-09-30" } })).json.staff[0].summary;
  assert.equal(s.absent, 1);
  assert.equal(s.basicEarned, 29000);
  assert.equal(s.ssf, Math.round(29000 * 0.11));
  assert.equal(s.ssfEmployer, Math.round(29000 * 0.20));
  assert.equal(s.gross, 29000 + 1000 + 500);
  assert.equal(s.takenOff, s.ssf + 5000 + 300 + 200);
  assert.equal(s.pay, s.gross - s.takenOff);
  assert.equal(s.adjustments.length, 5);
  const list = (await owner("adjust", { query: { from: "2026-09-01", to: "2026-09-30" } })).json.adjustments;
  assert.equal((await owner("adjust-delete", { method: "POST", body: { id: list[0].id } })).status, 200);
});

test("the owner's page needs the password", async () => {
  assert.equal((await call(attendanceRoute, { query: { action: "today" } })).status, 401);
  const t = await owner("today");
  assert.equal(t.status, 200);
  assert.ok(Array.isArray(t.json.rows));
});
