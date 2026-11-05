/* ==========================================================================
   App notifications: the हाजिरी app (attendance.html) pops up a notification
   on the phone the moment someone punches, like any other app. Free and
   unlimited; no Telegram or WhatsApp needed.
   --------------------------------------------------------------------------
   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY   the website's own key pair, made once
                                         (npx web-push generate-vapid-keys)
   VAPID_SUBJECT                         optional, mailto:… of the hotel

   A phone turns them on in the app (Settings → Notifications on this
   phone); its address at Google's or Apple's push service is kept in
   push_subs. Android: in Chrome, installed or not. iPhone: only once the app
   is on the home screen (iOS 16.4 or newer).
   ========================================================================== */

import webpush from "web-push";
import { q } from "./db.js";

const keys = () => ({ publicKey: process.env.VAPID_PUBLIC_KEY || "", privateKey: process.env.VAPID_PRIVATE_KEY || "" });
export const pushReady = () => !!(keys().publicKey && keys().privateKey);
export const pushPublicKey = () => keys().publicKey;

/* An attendance message (att-text.js, HTML) as a notification: the first
   line is the title, the rest the text under it. */
export function asNotification(text) {
  const plain = String(text).replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const [title, ...rest] = plain.split("\n");
  return { title: title.trim(), body: rest.join("\n").replace(/\n{2,}/g, "\n").trim() };
}

/* To one phone. Returns the push service's HTTP status. */
export async function pushTo(sub, message) {
  const details = webpush.generateRequestDetails(
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    JSON.stringify(message),
    { vapidDetails: { subject: process.env.VAPID_SUBJECT || "mailto:hotelperfectplaza@gmail.com", ...keys() }, TTL: 12 * 3600, urgency: "high" }
  );
  const res = await fetch(details.endpoint, { method: details.method, headers: details.headers, body: details.body });
  return res.status;
}

/* To every phone that turned notifications on. A phone that has turned
   them off, or uninstalled the app, answers 404/410 and is forgotten. */
export async function pushAll(text) {
  if (!pushReady()) return 0;
  const subs = await q(`SELECT endpoint, p256dh, auth FROM push_subs`);
  const message = asNotification(text);
  const ok = [];
  await Promise.all(subs.map(async s => {
    try {
      const status = await pushTo(s, message);
      if (status >= 200 && status < 300) ok.push(s.endpoint);
      else if (status === 404 || status === 410) await q(`DELETE FROM push_subs WHERE endpoint = $1`, [s.endpoint]);
      else console.error("push", status, s.endpoint.slice(0, 60));
    } catch (e) { console.error("push", e); }
  }));
  if (ok.length) await q(`UPDATE push_subs SET last_ok = now() WHERE endpoint = ANY($1::text[])`, [ok]).catch(() => {});
  return ok.length;
}
