/* /api/attendance-cron  — the day's attendance to every phone, each evening.
   Run by Vercel Cron (vercel.json: 15:15 UTC = 9 pm in Nepal; on the free
   plan Vercel may run it any time in that hour). Vercel signs the call with
   CRON_SECRET when that is set. Switched off in Settings → "Evening summary". */

import { getSettings, dailySummary } from "./_lib/attendance.js";
import { sendAll, telegramReady } from "./_lib/telegram.js";
import { json, handle } from "./_lib/http.js";

export default handle(async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const auth = String(req.headers.authorization || "");
  if (secret ? auth !== "Bearer " + secret : !/vercel-cron/i.test(String(req.headers["user-agent"] || ""))) return json(res, 401, { error: "cron" });
  if (!telegramReady()) return json(res, 200, { sent: 0, why: "no telegram" });
  const set = await getSettings();
  if (set.notify_summary !== "1") return json(res, 200, { sent: 0, why: "off" });
  json(res, 200, { sent: await sendAll(await dailySummary()) });
});
