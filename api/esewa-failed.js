/* POST /api/esewa-failed  { t: <transaction_uuid> }
   The guest came back from eSewa without paying: free the rooms now rather
   than when the hold runs out. If eSewa did take the money after all, the
   verify route still finds it (it accepts a "failed" booking). */

import { markFailed } from "./_lib/bookings.js";
import { json, body, handle, only } from "./_lib/http.js";

export default handle(async (req, res) => {
  if (!only(req, res, "POST")) return;
  const t = String(body(req).t || "");
  if (!/^[A-Z0-9-]{8,60}$/i.test(t)) return json(res, 400, { error: "missing" });
  await markFailed(t);
  json(res, 200, { ok: true });
});
