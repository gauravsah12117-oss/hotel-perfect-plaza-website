/* ==========================================================================
   Telegram: the attendance messages to the owner's phone.
   --------------------------------------------------------------------------
   TELEGRAM_BOT_TOKEN   from @BotFather in Telegram (see ATTENDANCE.md)

   Who gets the messages is kept in telegram_chats. A phone is added from
   attendance.html: it makes a one-time link, the phone opens it and presses
   Start, and Telegram tells /api/telegram (the webhook), which adds it.

   No token, no messages: punches are still recorded and shown.
   ========================================================================== */

import { createHash } from "node:crypto";
import { q } from "./db.js";

const token = () => process.env.TELEGRAM_BOT_TOKEN || "";
export const telegramReady = () => !!token();

/* Telegram sends this back on every webhook call, so /api/telegram knows
   the call is really from Telegram. */
export const webhookSecret = () => createHash("sha256").update("hpp-telegram:" + token()).digest("hex").slice(0, 48);

export async function tg(method, payload = {}) {
  const res = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
  });
  let out = {}; try { out = await res.json(); } catch (e) {}
  return { status: res.status, ...out };
}

let me = null;
export async function botName() {
  if (!telegramReady()) return null;
  if (!me) { const r = await tg("getMe"); if (r.ok) me = r.result.username; }
  return me;
}

export function sendTo(chatId, text) {
  return tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", link_preview_options: { is_disabled: true } });
}

/* To every phone that's switched on. A phone that has blocked the bot is
   switched off, so it isn't tried again and again. */
export async function sendAll(text) {
  if (!telegramReady()) return 0;
  const chats = await q(`SELECT chat_id FROM telegram_chats WHERE active`);
  let sent = 0;
  for (const c of chats) {
    try {
      const r = await sendTo(c.chat_id, text);
      if (r.ok) sent++;
      else if (r.status === 403) await q(`UPDATE telegram_chats SET active = false WHERE chat_id = $1`, [c.chat_id]);
      else console.error("telegram", r.status, r.description);
    } catch (e) { console.error("telegram", e); }
  }
  return sent;
}
