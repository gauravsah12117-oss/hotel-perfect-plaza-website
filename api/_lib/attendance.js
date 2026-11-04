/* ==========================================================================
   Staff attendance: the fingerprint machine's punches, turned into days at
   work, late arrivals, overtime and a month's pay.
   --------------------------------------------------------------------------
   Tables (they create themselves, like the booking tables in db.js):
     staff          one row per person, keyed by their user number on the
                    machine ("PIN"); shift, weekly day off, salary
     punches        every finger on the machine, and punches added by hand
                    for someone who forgot; never deleted, only ignored
     staff_leave    a day of leave for one person: paid, sick or unpaid
     holidays       a day off for everyone
     att_devices    the machines that have called in; punches count only
                    from a machine the owner has approved
     att_settings   the hotel's rules and message switches
     telegram_chats who gets the messages

   Times are Nepal wall-clock times, as the machine's clock shows them, kept
   in "timestamp" columns (no time zone) and handled here as milliseconds
   counted as if they were UTC, so nothing ever shifts them by 5:45.

   A person's work day starts 4 hours before their shift does, so a night
   guard who comes at 8 pm and leaves at 8 am has one day, not two halves.
   Within a day the first punch is arriving and the last is leaving; one in
   between is going out (a break), the next coming back. A second press
   within two minutes of the last is the same punch.
   ========================================================================== */

import { q, addSchema } from "./db.js";
import { sendAll, telegramReady } from "./telegram.js";
import { punchText, lateUploadText, summaryText } from "./att-text.js";

addSchema([
  `CREATE TABLE IF NOT EXISTS staff (
     pin         text PRIMARY KEY,
     name        text NOT NULL DEFAULT '',
     job         text NOT NULL DEFAULT '',
     phone       text NOT NULL DEFAULT '',
     shift_start text NOT NULL DEFAULT '',
     shift_end   text NOT NULL DEFAULT '',
     weekly_off  integer CHECK (weekly_off BETWEEN 0 AND 6),
     salary      integer NOT NULL DEFAULT 0,
     ot_rate     integer NOT NULL DEFAULT 0,
     joined      date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kathmandu')::date,
     active      boolean NOT NULL DEFAULT true,
     notify      boolean NOT NULL DEFAULT true,
     created_at  timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS punches (
     id          bigserial PRIMARY KEY,
     pin         text NOT NULL,
     at          timestamp NOT NULL,
     source      text NOT NULL DEFAULT 'machine' CHECK (source IN ('machine','manual')),
     device      text NOT NULL DEFAULT '',
     verify      integer,
     note        text NOT NULL DEFAULT '',
     ignored     boolean NOT NULL DEFAULT false,
     received_at timestamptz NOT NULL DEFAULT now(),
     UNIQUE (pin, at)
   )`,
  `CREATE INDEX IF NOT EXISTS punches_at ON punches (at)`,
  `CREATE TABLE IF NOT EXISTS staff_leave (
     pin  text NOT NULL,
     day  date NOT NULL,
     kind text NOT NULL CHECK (kind IN ('paid','sick','unpaid')),
     note text NOT NULL DEFAULT '',
     PRIMARY KEY (pin, day)
   )`,
  `CREATE TABLE IF NOT EXISTS holidays (day date PRIMARY KEY, name text NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS att_devices (
     sn            text PRIMARY KEY,
     name          text NOT NULL DEFAULT '',
     approved      boolean NOT NULL DEFAULT false,
     info          text NOT NULL DEFAULT '',
     ip            text NOT NULL DEFAULT '',
     attlog_stamp  text NOT NULL DEFAULT 'None',
     operlog_stamp text NOT NULL DEFAULT 'None',
     clock_fast    integer,
     first_seen    timestamptz NOT NULL DEFAULT now(),
     last_seen     timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS att_settings (key text PRIMARY KEY, value text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS telegram_chats (
     chat_id  text PRIMARY KEY,
     name     text NOT NULL DEFAULT '',
     active   boolean NOT NULL DEFAULT true,
     added_at timestamptz NOT NULL DEFAULT now()
   )`
]);

/* ------------------------------------------------------------- the clock */

export const MIN = 60000, DAY = 86400000;
export const nowNepal = (now = Date.now()) => now + 345 * MIN;           /* UTC+5:45 */

/* "2026-11-05 09:02[:07]" → ms; null if it isn't a real date and time */
export function wall(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(s || "").trim());
  if (!m || +m[4] > 23 || +m[5] > 59 || +(m[6] || 0) > 59) return null;
  const t = Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  return dayOf(t) === `${m[1]}-${m[2]}-${m[3]}` ? t : null;
}
export const wallText = t => new Date(t).toISOString().slice(0, 19).replace("T", " ");
export const dayOf = t => new Date(t).toISOString().slice(0, 10);
export const dayStart = d => Date.parse(d + "T00:00:00Z");
export const okDay = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || "")) && dayOf(dayStart(d) || 0) === d;
export const addDays = (d, n) => dayOf(dayStart(d) + n * DAY);
export const hhmm = t => new Date(t).toISOString().slice(11, 16);
export const toMin = s => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || ""));
  return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null;
};
export const staffName = s => (s.name || "").trim() || "Staff #" + s.pin;

/* ------------------------------------------------------------- settings */

export const DEFAULTS = {
  shift_start: "09:00", shift_end: "18:00",  /* for anyone without their own shift */
  grace: "10",            /* minutes after the shift starts before it counts as late */
  ot_min: "30",           /* overtime shorter than this isn't counted */
  ot_multiplier: "1.5",   /* overtime pay per hour = ordinary hourly pay × this */
  notify_in: "1", notify_out: "1", notify_summary: "1",
  lang: "en"              /* the messages: en or ne */
};

export async function getSettings() {
  const s = { ...DEFAULTS };
  for (const r of await q(`SELECT key, value FROM att_settings`)) s[r.key] = r.value;
  return s;
}
export const setSetting = (key, value) => q(
  `INSERT INTO att_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [key, String(value)]);

const rules = set => ({
  grace: Math.max(0, Number(set.grace) || 0),
  otMin: Math.max(0, Number(set.ot_min) || 0),
  otMult: Math.max(0, Number(set.ot_multiplier) || 1)
});

/* ------------------------------------------------------- shifts and days */

export const STAFF_COLS = `pin, name, job, phone, shift_start, shift_end, weekly_off, salary, ot_rate,
  joined::text AS joined, active, notify`;
export const STAFF_ORDER = `ORDER BY (pin !~ '^[0-9]+$'), lpad(pin, 20, '0'), pin`;

export function shiftOf(staff, set) {
  const start = toMin(staff.shift_start) ?? toMin(set.shift_start) ?? 540;
  const end = toMin(staff.shift_end) ?? toMin(set.shift_end) ?? 1080;
  const len = ((end - start + 1440) % 1440) || 1440;
  return { start, len, from: start - 240 };          /* the work day opens 4 h before the shift */
}
export const workDayOf = (t, shift) => dayOf(t - shift.from * MIN);
export const dayWindow = (day, shift) => { const a = dayStart(day) + shift.from * MIN; return [a, a + DAY]; };

/* Drops a press that comes within two minutes of the one before it. */
export function realPunches(list) {
  const out = []; let last = -Infinity;
  for (const p of list) { if (p.t - last >= 2 * MIN) out.push(p); last = p.t; }
  return out;
}

/* One person's day. punches: [{ id, t, source }] inside the day's window,
   in time order; now: Nepal wall time in ms.
   status: present | late | half | absent | leave | holiday | off |
           upcoming (not yet due, or a day still to come) | none (before
           they joined) */
export function dayRecord({ staff, day, punches, set, leave = null, holiday = null, now }) {
  const shift = shiftOf(staff, set), r = rules(set);
  const ps = realPunches(punches);
  const startT = dayStart(day) + shift.start * MIN, endT = startT + shift.len * MIN;
  const off = staff.weekly_off != null && Number(staff.weekly_off) === new Date(dayStart(day)).getUTCDay();
  const scheduled = !off && !holiday;
  const current = workDayOf(now, shift) === day;
  const rec = {
    day, shiftStart: hhmm(startT), shiftEnd: hhmm(endT), shiftLen: shift.len,
    punches: ps.map(p => ({ id: p.id, time: hhmm(p.t), at: wallText(p.t), manual: p.source === "manual" })),
    in: null, out: null, worked: 0, late: 0, early: 0, ot: 0,
    inside: false, missing: false, manual: ps.some(p => p.source === "manual"),
    holiday, leave, off, status: ""
  };

  if (!ps.length) {
    rec.status = day > workDayOf(now, shift) ? "upcoming"             /* a day still to come (leave etc. still shown) */
      : holiday ? "holiday" : leave ? "leave" : off ? "off" : day < staff.joined ? "none"
      : current && now < startT + r.grace * MIN ? "upcoming" : "absent";
    return rec;
  }

  const open = ps.length % 2 === 1;
  let worked = 0;
  for (let i = 0; i + 1 < ps.length; i += 2) worked += ps[i + 1].t - ps[i].t;
  if (open && current && now >= ps[ps.length - 1].t) { rec.inside = true; worked += now - ps[ps.length - 1].t; }
  else if (open) rec.missing = true;
  rec.worked = Math.round(worked / MIN);

  const first = ps[0], lastOut = open ? ps[ps.length - 2] : ps[ps.length - 1];
  rec.in = hhmm(first.t);
  if (lastOut && !rec.inside) rec.out = hhmm(lastOut.t);

  if (scheduled) {
    const lateBy = Math.round((first.t - startT) / MIN);
    rec.late = lateBy > r.grace ? lateBy : 0;
    if (lastOut && !rec.inside) {
      const early = Math.round((endT - lastOut.t) / MIN);
      rec.early = early > r.grace ? early : 0;
    }
  }
  const extra = scheduled ? rec.worked - shift.len : rec.worked;
  rec.ot = extra >= r.otMin && extra > 0 ? extra : 0;
  const half = scheduled && !rec.inside && !rec.missing && rec.worked < shift.len / 2;
  rec.status = half ? "half" : rec.late ? "late" : "present";
  return rec;
}

/* A person's totals over a run of days, and what they come to in rupees. */
export function summarise(staff, days, set) {
  const s = { days: 0, present: 0, late: 0, half: 0, absent: 0, paidLeave: 0, unpaidLeave: 0, off: 0, holiday: 0,
    notJoined: 0, extraDays: 0, lateMin: 0, earlyTimes: 0, worked: 0, ot: 0, missing: 0, manual: 0 };
  for (const d of days) {
    if (d.status === "upcoming") continue;
    s.days++;
    if (d.status === "present" || d.status === "late") s.present++;
    if (d.status === "late") { s.late++; s.lateMin += d.late; }
    if (d.status === "half") s.half++;
    if (d.status === "absent") s.absent++;
    if (d.status === "leave") d.leave === "unpaid" ? s.unpaidLeave++ : s.paidLeave++;
    if (d.status === "off") s.off++;
    if (d.status === "holiday") s.holiday++;
    if (d.status === "none") s.notJoined++;
    if (d.punches.length && (d.off || d.holiday)) s.extraDays++;
    if (d.early) s.earlyTimes++;
    if (d.missing) s.missing++;
    if (d.manual) s.manual++;
    s.worked += d.worked; s.ot += d.ot;
  }
  const r = rules(set), shift = shiftOf(staff, set);
  const salary = Number(staff.salary) || 0;
  const dayRate = salary / 30;                       /* Nepal's Labour Act counts a month as 30 days */
  const otHourly = Number(staff.ot_rate) || (dayRate / (shift.len / 60)) * r.otMult;
  s.paidDays = s.present + s.half / 2 + s.paidLeave + s.off + s.holiday;
  s.unpaidDays = s.absent + s.unpaidLeave + s.half / 2 + s.notJoined;
  s.dayRate = Math.round(dayRate);
  s.otHourly = Math.round(otHourly);
  s.otPay = Math.round(s.ot / 60 * otHourly);
  s.deduction = Math.round(s.unpaidDays * dayRate);
  s.pay = salary ? Math.max(0, salary - s.deduction) + s.otPay : 0;
  return s;
}

/* ----------------------------------------------------- reading the days */

export async function attendance(from, to, { now = nowNepal(), staffRows = null } = {}) {
  const set = await getSettings();
  const staff = staffRows || await q(`SELECT ${STAFF_COLS} FROM staff WHERE active ${STAFF_ORDER}`);
  const [punches, leave, hols] = await Promise.all([
    q(`SELECT id, pin, to_char(at, 'YYYY-MM-DD HH24:MI:SS') AS at, source FROM punches
       WHERE NOT ignored AND at >= $1::timestamp AND at < $2::timestamp ORDER BY at, id`,
      [wallText(dayStart(from) - DAY), wallText(dayStart(to) + 2 * DAY)]),
    q(`SELECT pin, day::text AS day, kind FROM staff_leave WHERE day BETWEEN $1::date AND $2::date`, [from, to]),
    q(`SELECT day::text AS day, name FROM holidays WHERE day BETWEEN $1::date AND $2::date`, [from, to])
  ]);
  const byPin = new Map();
  for (const p of punches) {
    if (!byPin.has(p.pin)) byPin.set(p.pin, []);
    byPin.get(p.pin).push({ id: Number(p.id), t: wall(p.at), source: p.source });
  }
  const leaveOf = new Map(leave.map(l => [l.pin + "|" + l.day, l.kind]));
  const holidayOf = new Map(hols.map(h => [h.day, h.name || "Holiday"]));
  const dates = [];
  for (let d = from; d <= to; d = addDays(d, 1)) dates.push(d);

  return {
    set, from, to, now: wallText(now),
    staff: staff.map(st => {
      const shift = shiftOf(st, set), mine = byPin.get(st.pin) || [];
      const days = dates.map(day => {
        const [a, b] = dayWindow(day, shift);
        return dayRecord({ staff: st, day, set, now, punches: mine.filter(p => p.t >= a && p.t < b),
          leave: leaveOf.get(st.pin + "|" + day) || null, holiday: holidayOf.get(day) || null });
      });
      return { ...st, displayName: staffName(st), days, summary: summarise(st, days, set) };
    })
  };
}

/* Today for everyone: each person's current work day (a night guard's
   started yesterday), and who is inside right now. */
export async function today(now = nowNepal()) {
  const d = dayOf(now);
  const res = await attendance(addDays(d, -1), d, { now });
  const rows = res.staff.map(st => {
    const cur = workDayOf(now, shiftOf(st, res.set));
    const rec = st.days.find(x => x.day === cur) || st.days[st.days.length - 1];
    return { pin: st.pin, name: st.displayName, job: st.job, rec };
  });
  return { set: res.set, day: d, now: res.now, rows };
}

export async function machines() {
  return q(`SELECT sn, name, approved, info, ip, clock_fast,
    to_char(first_seen AT TIME ZONE 'Asia/Kathmandu', 'YYYY-MM-DD HH24:MI') AS first_seen,
    to_char(last_seen AT TIME ZONE 'Asia/Kathmandu', 'YYYY-MM-DD HH24:MI') AS last_seen,
    EXTRACT(EPOCH FROM (now() - last_seen))::int AS ago FROM att_devices ORDER BY first_seen`);
}

export async function dailySummary(now = nowNepal()) {
  const [t, devs] = await Promise.all([today(now), machines()]);
  return summaryText(t, devs.filter(d => d.approved), t.set.lang);
}

/* ---------------------------------------------- punches from the machine */

/* rows: [{ pin, at: "YYYY-MM-DD HH:MM:SS", verify }]. Stores the new ones,
   adds anyone the hotel hasn't named yet as "Staff #<pin>", and sends the
   messages. Returns how many lines were taken. */
export async function recordPunches(rows, sn, now = nowNepal()) {
  rows = rows.filter(r => r.pin && wall(r.at) !== null);
  if (!rows.length) return { taken: 0, added: [] };
  /* someone joined no later than their first punch: new staff start then, so
     the days before aren't absences, and the machine's history moves an
     earlier join date back (it sends who is enrolled before their punches) */
  await q(`INSERT INTO staff (pin, joined) SELECT p, min(d) FROM unnest($1::text[], $2::date[]) AS x(p, d) GROUP BY p
    ON CONFLICT (pin) DO UPDATE SET joined = EXCLUDED.joined WHERE EXCLUDED.joined < staff.joined`, [rows.map(r => r.pin), rows.map(r => r.at.slice(0, 10))]);
  const added = await q(
    `INSERT INTO punches (pin, at, verify, device)
     SELECT p, a, v, $4 FROM unnest($1::text[], $2::timestamp[], $3::int[]) AS x(p, a, v)
     ON CONFLICT (pin, at) DO NOTHING
     RETURNING id, pin, to_char(at, 'YYYY-MM-DD HH24:MI:SS') AS at`,
    [rows.map(r => r.pin), rows.map(r => wallText(wall(r.at))), rows.map(r => Number.isInteger(r.verify) ? r.verify : null), sn]);

  /* a punch from the future means the machine's clock is fast */
  const newest = Math.max(...rows.map(r => wall(r.at)));
  const fast = Math.round((newest - now) / MIN);
  if (fast > 3) await q(`UPDATE att_devices SET clock_fast = $2 WHERE sn = $1`, [sn, fast]);
  else if (fast > -3) await q(`UPDATE att_devices SET clock_fast = NULL WHERE sn = $1 AND clock_fast IS NOT NULL`, [sn]);

  try { await announce(added, now); } catch (e) { console.error("attendance message", e); }
  return { taken: rows.length, added };
}

/* What a punch was: arriving, leaving or coming back; null for a double
   press or a person whose arrivals aren't messaged. */
export async function punchEvent(pin, at, set) {
  const [st] = await q(`SELECT ${STAFF_COLS} FROM staff WHERE pin = $1`, [pin]);
  if (!st || !st.active) return null;
  const shift = shiftOf(st, set), t = wall(at), day = workDayOf(t, shift), [a, b] = dayWindow(day, shift);
  const [ps, hol] = await Promise.all([
    q(`SELECT id, to_char(at, 'YYYY-MM-DD HH24:MI:SS') AS at, source FROM punches
       WHERE pin = $1 AND NOT ignored AND at >= $2::timestamp AND at <= $3::timestamp ORDER BY at, id`, [pin, wallText(a), wallText(Math.min(t, b - 1))]),
    q(`SELECT name FROM holidays WHERE day = $1::date`, [day])
  ]);
  const upto = ps.map(p => ({ id: Number(p.id), t: wall(p.at), source: p.source }));
  const real = realPunches(upto);
  if (!real.length || real[real.length - 1].t !== t) return null;
  const rec = dayRecord({ staff: st, day, punches: upto, set, holiday: hol[0] ? hol[0].name || "Holiday" : null, now: t });
  const n = real.length - 1;
  return { kind: n === 0 ? "in" : n % 2 ? "out" : "back", staff: st, name: staffName(st), t, rec };
}

async function announce(added, now) {
  if (!added.length || !telegramReady()) return;
  const set = await getSettings();
  const fresh = [], late = [];
  for (const p of added.sort((x, y) => wall(x.at) - wall(y.at))) {
    const age = now - wall(p.at);
    if (age <= 15 * MIN) fresh.push(p);                 /* punched just now */
    else if (age <= 12 * 3600000) late.push(p);         /* the machine was offline for a while */
  }                                                     /* older: the machine's history, kept quietly */
  for (const p of fresh) {
    const ev = await punchEvent(p.pin, p.at, set);
    if (!ev || !ev.staff.notify) continue;
    if (ev.kind === "in" ? set.notify_in !== "1" : set.notify_out !== "1") continue;
    await sendAll(punchText(ev, set.lang));
  }
  if (late.length) {
    const names = new Map((await q(`SELECT pin, name, notify FROM staff WHERE pin = ANY($1::text[])`, [late.map(p => p.pin)])).map(s => [s.pin, s]));
    const shown = late.filter(p => !names.get(p.pin) || names.get(p.pin).notify);
    if (shown.length) await sendAll(lateUploadText(shown.map(p => ({ name: staffName(names.get(p.pin) || { pin: p.pin }), t: wall(p.at) })), set.lang));
  }
}

/* "USER PIN=5\tName=Ram Sah\t…" lines (sent when someone is enrolled):
   fills in names the hotel hasn't typed yet. */
export async function recordUsers(users) {
  for (const u of users) {
    if (!u.pin) continue;
    await q(`INSERT INTO staff (pin, name) VALUES ($1, $2) ON CONFLICT (pin) DO UPDATE SET name = EXCLUDED.name WHERE staff.name = ''`, [u.pin, u.name || ""]);
  }
}
