/* /api/attendance?action=…  — for the owner's page, attendance.html.
   Every call needs the header  Authorization: Bearer <pass>, where the pass
   is the ATTENDANCE_PASSWORD (only to sign in) or the sign-in pass that
   action=login gives back. The page keeps the pass, never the password. A
   pass lasts 400 days and is signed with the password, so a new password
   in Vercel signs every phone out.
   Five wrong passwords from one address within 15 minutes lock that address
   out for 15 minutes (att_login_fails).

   POST action=login                    → { token }: the sign-in pass
   GET  action=backup&year=             everything, and that year's punches
   GET  action=today                    everyone's day so far, and the machines
   GET  action=report&from=&to=         every person's days and totals
   GET  action=punches&from=&to=&pin=   the punches themselves
   POST action=punch    { pin, day, time, note }    a punch someone forgot
   POST action=punch-ignore { id, ignored }  leave a wrong punch out (or back in)
   POST action=punch-delete { id }      only punches added by hand
   GET  action=staff
   POST action=staff    { pin, name, job, phone, shift_start, shift_end,
                          weekly_off, salary, ot_rate, joined, active, notify }
   GET  action=leave&from=&to=          leave and holidays
   POST action=leave    { pin, from, to, kind: paid|sick|unpaid|none, note }
   POST action=holiday  { day, name, remove }
   GET  action=settings                 rules, machines, phones, Telegram
   POST action=settings { grace, ot_min, … }
   POST action=device   { sn, approved, name, remove }
   POST action=telegram-link            a one-time link to add a phone
   POST action=chat     { chat_id, active, remove }
   GET  action=roster&from=             a week's roster (from = its first day)
   POST action=roster   { pin, day, shift: { name, start, end } | "off" | null }   null: their usual shift
   POST action=roster-copy { from }     the week before from, copied into the week from
   GET  action=adjust&from=&to=         advances, bonuses, allowances, tax, deductions
   POST action=adjust   { pin, day, kind, amount, note }
   POST action=adjust-delete { id }
   POST action=push-subscribe { subscription, name }  app notifications on this phone
   POST action=push-remove { endpoint }  …and off
   POST action=notify-test              a test to every phone (app and Telegram) */

import { createHash, createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { q } from "./_lib/db.js";
import {
  attendance, today, machines, getSettings, setSetting, DEFAULTS, STAFF_COLS, STAFF_ORDER, shiftList, checkAbsent,
  okDay, addDays, dayStart, wall, wallText, toMin, nowNepal, dayOf, DAY
} from "./_lib/attendance.js";
import { telegramReady, botName, tg, webhookSecret } from "./_lib/telegram.js";
import { pushReady, pushPublicKey } from "./_lib/push.js";
import { notifyAll, notifyReady } from "./_lib/notify.js";
import { json, body, handle, clean, origin } from "./_lib/http.js";

const digest = s => createHash("sha256").update(String(s)).digest();
const same = (a, b) => timingSafeEqual(digest(a), digest(b));

/* the sign-in pass: "v1.<expiry>.<signature>" */
const PASS_DAYS = 400;
const signer = () => createHash("sha256").update("hpp-attendance-pass:" + process.env.ATTENDANCE_PASSWORD).digest();
const sign = body => createHmac("sha256", signer()).update(body).digest("base64url");
export function makePass(now = Date.now()) {
  const body = "v1." + (now + PASS_DAYS * 86400000).toString(36);
  return body + "." + sign(body);
}
function passOk(given) {
  const m = /^(v1\.([0-9a-z]{1,12}))\.([A-Za-z0-9_-]{43})$/.exec(given);
  return !!m && parseInt(m[2], 36) > Date.now() && same(m[3], sign(m[1]));
}

/* null: not set up; "pass": a valid sign-in pass; "password"; false */
function authorised(req) {
  const pass = process.env.ATTENDANCE_PASSWORD;
  if (!pass) return null;
  const given = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!given) return false;
  if (passOk(given)) return "pass";
  return same(given, pass) ? "password" : false;
}

const ipOf = req => String(req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "").split(",")[0].trim().slice(0, 64);
async function lockedFor(ip) {
  const [r] = await q(`SELECT ceil(EXTRACT(EPOCH FROM (locked_until - now())) / 60)::int AS min FROM att_login_fails WHERE ip = $1 AND locked_until > now()`, [ip]);
  return r ? r.min : 0;
}
async function failed(ip) {
  await q(`INSERT INTO att_login_fails (ip, fails, first_at) VALUES ($1, 1, now())
    ON CONFLICT (ip) DO UPDATE SET
      fails = CASE WHEN att_login_fails.first_at < now() - interval '15 minutes' THEN 1 ELSE att_login_fails.fails + 1 END,
      first_at = CASE WHEN att_login_fails.first_at < now() - interval '15 minutes' THEN now() ELSE att_login_fails.first_at END,
      locked_until = CASE WHEN att_login_fails.first_at >= now() - interval '15 minutes' AND att_login_fails.fails + 1 >= 5
                          THEN now() + interval '15 minutes' ELSE NULL END`, [ip]);
}

const okPin = s => /^[0-9A-Za-z]{1,20}$/.test(String(s || ""));
const days = (from, to) => Math.round((dayStart(to) - dayStart(from)) / DAY) + 1;
function range(query, maxDays) {
  const t = dayOf(nowNepal());
  const from = okDay(query.from) ? query.from : t.slice(0, 8) + "01";
  let to = okDay(query.to) ? query.to : t;
  if (to < from) to = from;
  if (days(from, to) > maxDays) to = addDays(from, maxDays - 1);
  return { from, to };
}

export default handle(async (req, res) => {
  const auth = authorised(req);
  if (auth === null) return json(res, 503, { error: "setup" });
  if (auth !== "pass") {                                  /* a password, right or wrong: the lock applies */
    const ip = ipOf(req), min = await lockedFor(ip);
    if (min) return json(res, 429, { error: "locked", minutes: min });
    if (!auth) { await failed(ip); await new Promise(r => setTimeout(r, 600)); return json(res, 401, { error: "password" }); }
    await q(`DELETE FROM att_login_fails WHERE ip = $1`, [ip]);
  }

  const action = String(req.query.action || "");
  const b = body(req);
  const get = req.method === "GET", post = req.method === "POST";

  if (post && action === "login") return json(res, 200, { token: makePass() });

  if (get && action === "backup") {
    const year = /^\d{4}$/.test(String(req.query.year || "")) ? +req.query.year : +dayOf(nowNepal()).slice(0, 4);
    const [staff, leave, holidays, settings, machinesRows, punches, years] = await Promise.all([
      q(`SELECT ${STAFF_COLS} FROM staff ${STAFF_ORDER}`),
      q(`SELECT pin, day::text AS day, kind, note FROM staff_leave ORDER BY day, pin`),
      q(`SELECT day::text AS day, name FROM holidays ORDER BY day`),
      q(`SELECT key, value FROM att_settings WHERE key <> 'tg_link' ORDER BY key`),
      q(`SELECT sn, name, approved FROM att_devices ORDER BY sn`),
      q(`SELECT pin, to_char(at, 'YYYY-MM-DD HH24:MI:SS') AS at, source, ignored, note FROM punches
         WHERE at >= $1::timestamp AND at < $2::timestamp ORDER BY at, id`, [`${year}-01-01 00:00:00`, `${year + 1}-01-01 00:00:00`]),
      q(`SELECT DISTINCT EXTRACT(YEAR FROM at)::int AS y FROM punches ORDER BY y`)
    ]);
    return json(res, 200, {
      hotel: "Hotel Perfect Plaza", made: wallText(nowNepal()), year, years: years.map(r => r.y),
      staff, leave, holidays, settings, machines: machinesRows,
      punchColumns: ["pin", "at", "source", "ignored", "note"],
      punches: punches.map(p => [p.pin, p.at, p.source, p.ignored ? 1 : 0, p.note])
    });
  }

  if (get && action === "today") {
    await checkAbsent().catch(e => console.error(e));                 /* someone is looking: a good moment for "not come yet" */
    const [t, devs] = await Promise.all([today(), machines()]);
    const chats = await q(`SELECT (SELECT count(*)::int FROM telegram_chats WHERE active) + (SELECT count(*)::int FROM push_subs) AS n`);
    return json(res, 200, { ...t, set: undefined, machines: devs, telegram: telegramReady(), push: pushReady(), notify: notifyReady(), phones: chats[0].n });
  }

  if (get && action === "report") {
    const { from, to } = range(req.query, 62);
    const r = await attendance(from, to);
    return json(res, 200, { from: r.from, to: r.to, now: r.now, staff: r.staff, ssf: { employee: r.set.ssf_employee, employer: r.set.ssf_employer } });
  }

  if (get && action === "punches") {
    const { from, to } = range(req.query, 62);
    const pin = okPin(req.query.pin) ? req.query.pin : null;
    const rows = await q(
      `SELECT p.id, p.pin, s.name, to_char(p.at, 'YYYY-MM-DD HH24:MI:SS') AS at, p.source, p.device, p.verify, p.note, p.ignored,
              to_char(p.received_at AT TIME ZONE 'Asia/Kathmandu', 'YYYY-MM-DD HH24:MI:SS') AS received
       FROM punches p LEFT JOIN staff s ON s.pin = p.pin
       WHERE p.at >= $1::timestamp AND p.at < $2::timestamp AND ($3::text IS NULL OR p.pin = $3)
       ORDER BY p.at DESC, p.id DESC LIMIT 3000`, [from + " 00:00:00", addDays(to, 1) + " 00:00:00", pin]);
    return json(res, 200, { from, to, punches: rows.map(r => ({ ...r, id: Number(r.id) })) });
  }

  if (post && action === "punch") {
    if (!okPin(b.pin)) return json(res, 400, { error: "pin" });
    const t = wall(`${b.day} ${b.time}`);
    if (t === null) return json(res, 400, { error: "time" });
    if (t > nowNepal() + 5 * 60000) return json(res, 400, { error: "future" });
    const st = await q(`SELECT pin FROM staff WHERE pin = $1`, [b.pin]);
    if (!st.length) return json(res, 400, { error: "pin" });
    const rows = await q(`INSERT INTO punches (pin, at, source, note) VALUES ($1, $2::timestamp, 'manual', $3)
      ON CONFLICT (pin, at) DO NOTHING RETURNING id`, [b.pin, wallText(t), clean(b.note, 200)]);
    return json(res, rows.length ? 200 : 409, rows.length ? { id: Number(rows[0].id) } : { error: "exists" });
  }

  if (post && action === "punch-ignore") {
    const rows = await q(`UPDATE punches SET ignored = $2 WHERE id = $1 RETURNING id`, [Number(b.id) || 0, b.ignored !== false]);
    return json(res, rows.length ? 200 : 404, rows.length ? { ok: true } : { error: "unknown" });
  }

  if (post && action === "punch-delete") {
    const rows = await q(`DELETE FROM punches WHERE id = $1 AND source = 'manual' RETURNING id`, [Number(b.id) || 0]);
    return json(res, rows.length ? 200 : 404, rows.length ? { ok: true } : { error: "unknown" });
  }

  if (action === "staff") {
    if (post) {
      if (!okPin(b.pin)) return json(res, 400, { error: "pin" });
      const time = s => { s = clean(s, 5); return s === "" || toMin(s) !== null ? s : false; };
      const shiftStart = time(b.shift_start), shiftEnd = time(b.shift_end);
      if (shiftStart === false || shiftEnd === false || (shiftStart === "") !== (shiftEnd === "")) return json(res, 400, { error: "shift" });
      const off = b.weekly_off === "" || b.weekly_off == null ? null : Number(b.weekly_off);
      if (off !== null && !(Number.isInteger(off) && off >= 0 && off <= 6)) return json(res, 400, { error: "off" });
      const money = (v, max) => { const n = Math.round(Number(v) || 0); return n >= 0 && n <= max ? n : false; };
      const salary = money(b.salary, 10000000), otRate = money(b.ot_rate, 100000);
      if (salary === false || otRate === false) return json(res, 400, { error: "money" });
      const joined = okDay(b.joined) ? b.joined : null;
      await q(`INSERT INTO staff (pin, name, job, phone, shift_start, shift_end, weekly_off, salary, ot_rate, joined, active, notify, ssf)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::date, (now() AT TIME ZONE 'Asia/Kathmandu')::date), $11, $12, $13)
        ON CONFLICT (pin) DO UPDATE SET name = EXCLUDED.name, job = EXCLUDED.job, phone = EXCLUDED.phone,
          shift_start = EXCLUDED.shift_start, shift_end = EXCLUDED.shift_end, weekly_off = EXCLUDED.weekly_off,
          salary = EXCLUDED.salary, ot_rate = EXCLUDED.ot_rate, joined = COALESCE($10::date, staff.joined),
          active = EXCLUDED.active, notify = EXCLUDED.notify, ssf = EXCLUDED.ssf`,
        [b.pin, clean(b.name, 80), clean(b.job, 60), clean(b.phone, 30), shiftStart, shiftEnd, off, salary, otRate, joined,
         b.active !== false, b.notify !== false, b.ssf === true]);
    }
    const rows = await q(`SELECT ${STAFF_COLS}, (SELECT count(*)::int FROM punches p WHERE p.pin = staff.pin) AS punches FROM staff ${STAFF_ORDER}`);
    return json(res, 200, { staff: rows });
  }

  if (get && action === "leave") {
    const { from, to } = range(req.query, 400);
    const [leave, holidays] = await Promise.all([
      q(`SELECT l.pin, s.name, l.day::text AS day, l.kind, l.note FROM staff_leave l LEFT JOIN staff s ON s.pin = l.pin
         WHERE l.day BETWEEN $1::date AND $2::date ORDER BY l.day, l.pin`, [from, to]),
      q(`SELECT day::text AS day, name FROM holidays WHERE day BETWEEN $1::date AND $2::date ORDER BY day`, [from, to])
    ]);
    return json(res, 200, { from, to, leave, holidays });
  }

  if (post && action === "leave") {
    if (!okPin(b.pin)) return json(res, 400, { error: "pin" });
    if (!okDay(b.from) || !okDay(b.to || b.from)) return json(res, 400, { error: "dates" });
    const to = b.to || b.from;
    if (to < b.from || days(b.from, to) > 62) return json(res, 400, { error: "dates" });
    if (b.kind === "none") {
      await q(`DELETE FROM staff_leave WHERE pin = $1 AND day BETWEEN $2::date AND $3::date`, [b.pin, b.from, to]);
      return json(res, 200, { ok: true });
    }
    if (!["paid", "sick", "unpaid"].includes(b.kind)) return json(res, 400, { error: "kind" });
    await q(`INSERT INTO staff_leave (pin, day, kind, note)
      SELECT $1, d::date, $4, $5 FROM generate_series($2::date, $3::date, interval '1 day') AS g(d)
      ON CONFLICT (pin, day) DO UPDATE SET kind = EXCLUDED.kind, note = EXCLUDED.note`, [b.pin, b.from, to, b.kind, clean(b.note, 200)]);
    return json(res, 200, { ok: true });
  }

  if (post && action === "holiday") {
    if (!okDay(b.day)) return json(res, 400, { error: "dates" });
    if (b.remove) await q(`DELETE FROM holidays WHERE day = $1::date`, [b.day]);
    else await q(`INSERT INTO holidays (day, name) VALUES ($1::date, $2) ON CONFLICT (day) DO UPDATE SET name = EXCLUDED.name`, [b.day, clean(b.name, 80)]);
    return json(res, 200, { ok: true });
  }

  if (action === "settings") {
    if (post) {
      const v = b.settings || {};
      const checks = {
        shift_start: s => toMin(s) !== null, shift_end: s => toMin(s) !== null,
        grace: s => /^\d{1,3}$/.test(s), ot_min: s => /^\d{1,3}$/.test(s),
        ot_multiplier: s => /^\d{1,2}(\.\d{1,2})?$/.test(s) && Number(s) > 0,
        notify_in: s => /^[01]$/.test(s), notify_out: s => /^[01]$/.test(s), notify_summary: s => /^[01]$/.test(s),
        lang: s => s === "en" || s === "ne",
        ssf_employee: s => /^\d{1,2}(\.\d{1,2})?$/.test(s), ssf_employer: s => /^\d{1,2}(\.\d{1,2})?$/.test(s),
        notify_absent: s => /^[01]$/.test(s), notify_month: s => /^[01]$/.test(s), absent_after: s => /^\d{1,3}$/.test(s),
        quiet_from: s => s === "" || toMin(s) !== null, quiet_to: s => s === "" || toMin(s) !== null,
        shifts: s => { try { const l = JSON.parse(s); return Array.isArray(l) && l.length <= 8 && l.every(x => x && typeof x.name === "string" && x.name.trim() && x.name.length <= 24 && toMin(x.start) !== null && toMin(x.end) !== null); } catch (e) { return false; } }
      };
      for (const [k, ok] of Object.entries(checks)) if (k in v && !ok(String(v[k]))) return json(res, 400, { error: "setting", key: k });
      for (const k of Object.keys(checks)) if (k in v) await setSetting(k, String(v[k]));
    }
    const [set, devs, chats, subs] = await Promise.all([getSettings(), machines(),
      q(`SELECT chat_id, name, active, to_char(added_at AT TIME ZONE 'Asia/Kathmandu', 'YYYY-MM-DD') AS added FROM telegram_chats ORDER BY added_at`),
      q(`SELECT endpoint, name, to_char(added_at AT TIME ZONE 'Asia/Kathmandu', 'YYYY-MM-DD') AS added,
           to_char(last_ok AT TIME ZONE 'Asia/Kathmandu', 'YYYY-MM-DD HH24:MI') AS last_ok FROM push_subs ORDER BY added_at`)]);
    let bot = null; try { bot = await botName(); } catch (e) {}
    return json(res, 200, { settings: Object.fromEntries(Object.keys(DEFAULTS).map(k => [k, set[k]])), machines: devs, chats, devices: subs,
      telegram: { ready: telegramReady(), bot }, push: { ready: pushReady(), key: pushPublicKey() },
      server: { host: String(req.headers["x-forwarded-host"] || req.headers.host || "") } });
  }

  /* the weekly roster */
  if (get && action === "roster") {
    const from = okDay(req.query.from) ? req.query.from : dayOf(nowNepal());
    const to = addDays(from, 6);
    const [set, staffRows, entries] = await Promise.all([getSettings(),
      q(`SELECT pin, name, job, shift_start, shift_end, weekly_off FROM staff WHERE active ${STAFF_ORDER}`),
      q(`SELECT pin, day::text AS day, name, start, finish, off FROM roster WHERE day BETWEEN $1::date AND $2::date`, [from, to])]);
    return json(res, 200, { from, to, shifts: shiftList(set), usual: { start: set.shift_start, end: set.shift_end },
      staff: staffRows, entries: entries.map(e => ({ pin: e.pin, day: e.day, name: e.name, start: e.start, end: e.finish, off: e.off })) });
  }

  if (post && action === "roster") {
    if (!okPin(b.pin) || !okDay(b.day)) return json(res, 400, { error: "dates" });
    if (b.shift == null) await q(`DELETE FROM roster WHERE pin = $1 AND day = $2::date`, [b.pin, b.day]);
    else {
      const off = b.shift === "off", s = off ? {} : b.shift;
      if (!off && (toMin(s.start) === null || toMin(s.end) === null)) return json(res, 400, { error: "shift" });
      await q(`INSERT INTO roster (pin, day, name, start, finish, off) VALUES ($1, $2::date, $3, $4, $5, $6)
        ON CONFLICT (pin, day) DO UPDATE SET name = EXCLUDED.name, start = EXCLUDED.start, finish = EXCLUDED.finish, off = EXCLUDED.off`,
        [b.pin, b.day, off ? "" : clean(s.name, 24), off ? "" : s.start, off ? "" : s.end, off]);
    }
    return json(res, 200, { ok: true });
  }

  if (post && action === "roster-copy") {
    if (!okDay(b.from)) return json(res, 400, { error: "dates" });
    const to = addDays(b.from, 6);
    await q(`DELETE FROM roster WHERE day BETWEEN $1::date AND $2::date`, [b.from, to]);
    await q(`INSERT INTO roster (pin, day, name, start, finish, off)
      SELECT pin, day + 7, name, start, finish, off FROM roster WHERE day BETWEEN $1::date - 7 AND $2::date - 7`, [b.from, to]);
    return json(res, 200, { ok: true });
  }

  /* money for the payslips */
  if (get && action === "adjust") {
    const { from, to } = range(req.query, 400);
    const rows = await q(`SELECT a.id, a.pin, s.name, a.day::text AS day, a.kind, a.amount, a.note FROM pay_adjust a LEFT JOIN staff s ON s.pin = a.pin
      WHERE a.day BETWEEN $1::date AND $2::date ORDER BY a.day, a.id`, [from, to]);
    return json(res, 200, { from, to, adjustments: rows.map(r => ({ ...r, id: Number(r.id) })) });
  }

  if (post && action === "adjust") {
    if (!okPin(b.pin) || !okDay(b.day)) return json(res, 400, { error: "dates" });
    if (!["advance", "bonus", "allowance", "tax", "deduction"].includes(b.kind)) return json(res, 400, { error: "kind" });
    const amount = Math.round(Number(b.amount));
    if (!(amount > 0 && amount <= 10000000)) return json(res, 400, { error: "money" });
    const rows = await q(`INSERT INTO pay_adjust (pin, day, kind, amount, note) VALUES ($1, $2::date, $3, $4, $5) RETURNING id`,
      [b.pin, b.day, b.kind, amount, clean(b.note, 120)]);
    return json(res, 200, { id: Number(rows[0].id) });
  }

  if (post && action === "adjust-delete") {
    const rows = await q(`DELETE FROM pay_adjust WHERE id = $1 RETURNING id`, [Number(b.id) || 0]);
    return json(res, rows.length ? 200 : 404, rows.length ? { ok: true } : { error: "unknown" });
  }

  /* this phone's app notifications: on (its push address) or off */
  if (post && action === "push-subscribe") {
    const s = b.subscription || {};
    const endpoint = String(s.endpoint || ""), p256dh = String((s.keys || {}).p256dh || ""), authKey = String((s.keys || {}).auth || "");
    if (!/^https:\/\/[^\s]{10,1000}$/.test(endpoint) || !/^[A-Za-z0-9_-]{40,200}$/.test(p256dh) || !/^[A-Za-z0-9_-]{10,100}$/.test(authKey)) return json(res, 400, { error: "subscription" });
    await q(`INSERT INTO push_subs (endpoint, p256dh, auth, name) VALUES ($1, $2, $3, $4)
      ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, name = EXCLUDED.name`, [endpoint, p256dh, authKey, clean(b.name, 60) || "Phone"]);
    return json(res, 200, { ok: true });
  }
  if (post && action === "push-remove") {
    await q(`DELETE FROM push_subs WHERE endpoint = $1`, [String(b.endpoint || "")]);
    return json(res, 200, { ok: true });
  }

  if (post && action === "device") {
    const sn = clean(b.sn, 40);
    if (b.remove) await q(`DELETE FROM att_devices WHERE sn = $1`, [sn]);
    else {
      const rows = await q(`UPDATE att_devices SET approved = COALESCE($2, approved), name = COALESCE($3, name) WHERE sn = $1 RETURNING sn`,
        [sn, typeof b.approved === "boolean" ? b.approved : null, b.name == null ? null : clean(b.name, 60)]);
      if (!rows.length) return json(res, 404, { error: "unknown" });
    }
    return json(res, 200, { ok: true });
  }

  if (post && action === "telegram-link") {
    if (!telegramReady()) return json(res, 503, { error: "telegram" });
    const hook = await tg("setWebhook", { url: origin(req) + "/api/telegram", secret_token: webhookSecret(), allowed_updates: ["message"] });
    if (!hook.ok) return json(res, 502, { error: "webhook", detail: hook.description || "" });
    await tg("setMyCommands", { commands: [{ command: "today", description: "Today's attendance" }, { command: "now", description: "Who is in the hotel now" }] });
    const code = randomBytes(9).toString("base64url");
    await setSetting("tg_link", code + "|" + (Date.now() + 60 * 60000));
    const bot = await botName();
    return json(res, 200, { link: `https://t.me/${bot}?start=${code}`, bot });
  }

  if (post && action === "chat") {
    const id = clean(b.chat_id, 30);
    if (b.remove) await q(`DELETE FROM telegram_chats WHERE chat_id = $1`, [id]);
    else await q(`UPDATE telegram_chats SET active = $2 WHERE chat_id = $1`, [id, b.active !== false]);
    return json(res, 200, { ok: true });
  }

  if (post && (action === "notify-test" || action === "telegram-test")) {
    if (!notifyReady()) return json(res, 503, { error: "notify" });
    const set = await getSettings();
    const sent = await notifyAll(set.lang === "ne" ? "🔔 परीक्षण सन्देश\nहोटल पर्फेक्ट प्लाजा हाजिरी। यो आयो भने सबै ठीक छ।" : "🔔 Test message\nHotel Perfect Plaza attendance. If you can see this, notifications are working.");
    return json(res, 200, { sent });
  }

  json(res, 400, { error: "action" });
});
