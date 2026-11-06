/* /api/attendance-cron  — run by Vercel Cron twice a day (vercel.json; on
   the free plan Vercel may run each any time in its hour). Vercel signs the
   call with CRON_SECRET when that is set.

   04:45 UTC = 10:30 am in Nepal: the "not come yet" check, in case no punch
             or opened app has run it this morning.
   15:15 UTC =  9:00 pm in Nepal: the day's summary to every phone, and on the
             last day of a Nepali month the month's totals too. Switched off
             in Settings. */

import { getSettings, dailySummary, monthSummary, checkAbsent, nowNepal } from "./_lib/attendance.js";
import { notifyAll, notifyReady } from "./_lib/notify.js";
import { json, handle } from "./_lib/http.js";

export default handle(async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const auth = String(req.headers.authorization || "");
  if (secret ? auth !== "Bearer " + secret : !/vercel-cron/i.test(String(req.headers["user-agent"] || ""))) return json(res, 401, { error: "cron" });
  if (!notifyReady()) return json(res, 200, { sent: 0, why: "no telegram or app notifications" });
  const now = nowNepal(), job = String((req.query || {}).job || (new Date(now).getUTCHours() < 16 ? "morning" : "evening"));
  if (job === "morning") return json(res, 200, { absent: await checkAbsent(now, { force: true }) });
  const set = await getSettings();
  let sent = 0;
  if (set.notify_summary === "1") sent += await notifyAll(await dailySummary(now));
  if (set.notify_month === "1") { const m = await monthSummary(now); if (m) sent += await notifyAll(m); }
  json(res, 200, { sent });
});
