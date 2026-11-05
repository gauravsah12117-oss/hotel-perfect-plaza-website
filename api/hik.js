/* ==========================================================================
   /api/hik  — where a Hikvision fingerprint / face terminal sends its punches.
   --------------------------------------------------------------------------
   Hikvision's "HTTP Listening" (on the terminal: Configuration → Network →
   Network Service → HTTP Listening, or the same in iVMS-4200 / Hik-Connect):
   the terminal POSTs every event to this address. A punch is an
   "AccessControllerEvent" with the person's employee number:

     { "dateTime": "2026-11-05T09:02:07+05:45", "macAddress": "c0:56:…",
       "eventType": "AccessControllerEvent",
       "AccessControllerEvent": { "employeeNoString": "5", "subEventType": 38, … } }

   It arrives as plain JSON, as one part of multipart/form-data (with a face
   photo beside it), or on older firmware as XML; all three are read.
   Events without an employee number (a door opening, a finger not
   recognised) and heartbeats only mark the terminal as seen.

   The terminal is known by its MAC address ("HIK-C0:56:…") and, like the
   ZKTeco machines (api/iclock.js), its punches count only once it is
   approved in attendance.html → Settings. Before that they are not kept:
   approve it, then punch once to check.
   ========================================================================== */

import { q } from "./_lib/db.js";
import { recordPunches, nowNepal, wall, wallText } from "./_lib/attendance.js";
import { clean } from "./_lib/http.js";

const ok = () => new Response("OK", { status: 200, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });

/* how the person was recognised, as the ZKTeco codes the app already names */
const VERIFY = { 1: 4, 38: 1, 75: 15 };     /* card, fingerprint, face */

/* the events in a request body, whatever its shape */
export function readEvents(body, contentType) {
  const text = body.toString("utf8");
  const out = [];
  const tryJson = s => { try { const j = JSON.parse(s); out.push(...(Array.isArray(j) ? j : [j])); return true; } catch (e) { return false; } };
  const tryXml = s => {
    if (!/<EventNotificationAlert/i.test(s)) return false;
    const tag = n => { const m = new RegExp(`<${n}>([^<]*)</${n}>`, "i").exec(s); return m ? m[1].trim() : ""; };
    out.push({ dateTime: tag("dateTime"), macAddress: tag("macAddress"), ipAddress: tag("ipAddress"), eventType: tag("eventType"),
      AccessControllerEvent: { employeeNoString: tag("employeeNoString") || tag("employeeNo"), subEventType: +tag("subEventType") || null, name: tag("name") } });
    return true;
  };
  const boundary = /boundary="?([^";]+)"?/i.exec(contentType || "");
  if (/multipart/i.test(contentType || "") && boundary) {
    for (const part of text.split("--" + boundary[1])) {
      const cut = part.indexOf("\r\n\r\n") >= 0 ? part.indexOf("\r\n\r\n") + 4 : part.indexOf("\n\n") + 2;
      if (cut < 2) continue;
      const head = part.slice(0, cut), content = part.slice(cut).replace(/\r?\n$/, "");
      if (/image\//i.test(head)) continue;                                  /* the face photo */
      if (!tryJson(content.trim())) tryXml(content);
    }
  } else if (!tryJson(text.trim())) tryXml(text);
  return out;
}

/* the event's time as Nepal wall time "YYYY-MM-DD HH:MM:SS" */
export function nepalTime(dateTime) {
  const s = String(dateTime || "").trim();
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {                                   /* with a time zone: exact */
    const t = Date.parse(s);
    return isNaN(t) ? null : wallText(nowNepal(t));
  }
  const t = wall(s.replace("T", " ").slice(0, 19));                          /* without: the terminal's own clock */
  return t === null ? null : wallText(t);
}

async function seen(sn, ip, info) {
  const rows = await q(
    `INSERT INTO att_devices (sn, ip, info) VALUES ($1, $2, $3)
     ON CONFLICT (sn) DO UPDATE SET last_seen = now(), ip = EXCLUDED.ip, info = CASE WHEN EXCLUDED.info = '' THEN att_devices.info ELSE EXCLUDED.info END
     RETURNING approved`, [sn, ip, info]);
  return rows[0].approved;
}

export async function POST(request) {
  const body = Buffer.from(await request.arrayBuffer());
  const events = readEvents(body, request.headers.get("content-type"));
  const ip = clean(String(request.headers.get("x-forwarded-for") || "").split(",")[0], 60);
  const bySn = new Map();
  for (const ev of events) {
    const mac = clean(ev.macAddress || "", 20).toUpperCase();
    if (!mac) continue;
    const sn = "HIK-" + mac;
    if (!bySn.has(sn)) bySn.set(sn, { info: clean(`Hikvision ${ev.AccessControllerEvent && ev.AccessControllerEvent.deviceName || ""} ${ev.ipAddress || ""}`.replace(/\s+/g, " "), 300), rows: [] });
    const a = ev.AccessControllerEvent;
    const pin = a && clean(a.employeeNoString || a.employeeNo || "", 20);
    const at = pin && nepalTime(ev.dateTime);
    if (pin && at) bySn.get(sn).rows.push({ pin, at, verify: VERIFY[a.subEventType] ?? null });
  }
  for (const [sn, { info, rows }] of bySn) {
    const approved = await seen(sn, ip, info);
    if (approved && rows.length) await recordPunches(rows, sn, nowNepal());
  }
  return ok();
}

/* some terminals test the address with a GET first */
export const GET = () => ok();
