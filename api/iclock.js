/* ==========================================================================
   /iclock/…  — where the fingerprint machine sends its punches.
   --------------------------------------------------------------------------
   ZKTeco's push protocol (on the machine: Menu → Comm → Cloud Server
   Setting, also called ADMS; eSSL machines use it too). vercel.json sends
   /iclock/<op> here as ?op=<op>:

   GET  cdata?SN=…                 the machine starting up: it's told what to
                                   send and from which record on
   POST cdata?SN=…&table=ATTLOG    punches, one per line:
                                   PIN \t 2026-11-05 09:02:07 \t status \t verify …
   POST cdata?SN=…&table=OPERLOG   "USER PIN=5 \t Name=Ram …" when someone
                                   is enrolled, and the machine's own log
   GET  getrequest?SN=…            every 30 seconds: "any commands?" — no
   POST devicecmd?SN=…             replies to commands — none are sent

   A machine is recorded the first time it calls, but its punches are only
   taken once the owner approves it on attendance.html → Settings. Until then
   it's told no, so it keeps them and sends them again after approval.

   Written as a Web handler (Request → Response) because the machine's
   body is tab-separated text, which must arrive exactly as sent.
   ========================================================================== */

import { q } from "./_lib/db.js";
import { recordPunches, recordUsers, nowNepal } from "./_lib/attendance.js";
import { clean } from "./_lib/http.js";

const text = (body, status = 200) => new Response(body, { status, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });

function parse(request) {
  const url = new URL(request.url);
  const p = url.searchParams;
  const op = (p.get("op") || url.pathname.split("/").pop() || "").replace(/\.aspx$/i, "").toLowerCase();
  const ip = clean(String(request.headers.get("x-forwarded-for") || "").split(",")[0], 60);
  return { op, p, sn: clean(p.get("SN") || p.get("sn"), 40), ip };
}

async function device(sn, ip, info) {
  const rows = await q(
    `INSERT INTO att_devices (sn, ip, info) VALUES ($1, $2, $3)
     ON CONFLICT (sn) DO UPDATE SET last_seen = now(), ip = EXCLUDED.ip,
       info = CASE WHEN EXCLUDED.info = '' THEN att_devices.info ELSE EXCLUDED.info END
     RETURNING approved, attlog_stamp, operlog_stamp`, [sn, ip, info]);
  return rows[0];
}

/* "Any commands?" comes every 30 seconds. Writing "seen" each time would
   keep the database awake all day, so it's written at most every 30 minutes
   per running copy of this function; punches update it anyway. */
const touched = new Map();

export async function GET(request) {
  const { op, p, sn, ip } = parse(request);
  if (!sn) return text("OK");
  if (op === "cdata") {
    const info = clean([...p].filter(([k]) => !/^(sn|op)$/i.test(k)).map(([k, v]) => k + "=" + v).join(" "), 300);
    const d = await device(sn, ip, info);
    touched.set(sn, Date.now());
    const lines = [
      `GET OPTION FROM: ${sn}`,
      `ATTLOGStamp=${d.approved ? d.attlog_stamp : "None"}`,
      `OPERLOGStamp=${d.approved ? d.operlog_stamp : "None"}`,
      "ATTPHOTOStamp=9999",
      "ErrorDelay=30",
      "Delay=30",
      "TransTimes=00:00;14:05",
      "TransInterval=1",
      "TransFlag=TransData AttLog OpLog EnrollUser ChgUser",
      "Realtime=1",
      "Encrypt=None"
    ];
    if (process.env.ZK_TIMEZONE) lines.push("TimeZone=" + process.env.ZK_TIMEZONE);
    return text(lines.join("\n") + "\n");
  }
  if (op === "getrequest" && Date.now() - (touched.get(sn) || 0) > 30 * 60000) {
    touched.set(sn, Date.now());
    await device(sn, ip, clean(p.get("INFO") || "", 300)).catch(e => console.error(e));
  }
  return text("OK");
}

export async function POST(request) {
  const { op, p, sn, ip } = parse(request);
  const body = await request.text();
  if (!sn) return text("OK");
  if (op !== "cdata") return text("OK");
  const d = await device(sn, ip, "");
  touched.set(sn, Date.now());
  if (!d.approved) return text("Waiting for approval on attendance.html", 403);

  const table = String(p.get("table") || "").toUpperCase();
  const stamp = clean(p.get("Stamp") || p.get("stamp") || "", 30);
  const lines = body.split(/\r?\n/).map(l => l.replace(/\0/g, "")).filter(l => l.trim());

  if (table === "ATTLOG") {
    const rows = lines.map(line => {
      let f = line.split("\t");
      if (f.length < 2) { const x = line.trim().split(/\s+/); f = [x[0], x[1] + " " + x[2], x[3], x[4]]; }
      const verify = parseInt(f[3], 10);
      return { pin: clean(f[0], 20), at: clean(f[1], 19), verify: Number.isInteger(verify) ? verify : null };
    });
    const { taken } = await recordPunches(rows, sn, nowNepal());
    if (stamp) await q(`UPDATE att_devices SET attlog_stamp = $2 WHERE sn = $1`, [sn, stamp]);
    return text("OK: " + taken);
  }

  /* enrolments, whatever table the firmware calls them */
  const users = lines.filter(l => /^(USER\s+)?PIN=/i.test(l.trim())).map(l => {
    const f = Object.fromEntries(l.trim().replace(/^USER\s+/i, "").split("\t").map(kv => { const i = kv.indexOf("="); return [kv.slice(0, i).trim().toLowerCase(), kv.slice(i + 1)]; }));
    return { pin: clean(f.pin, 20), name: clean(f.name, 80) };
  });
  if (users.length) await recordUsers(users);
  if (table === "OPERLOG" && stamp) await q(`UPDATE att_devices SET operlog_stamp = $2 WHERE sn = $1`, [sn, stamp]);
  return text("OK");
}
