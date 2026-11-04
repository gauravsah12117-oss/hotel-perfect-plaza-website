/* /api/telegram  — Telegram's webhook: messages people send to the bot.
   Set up by attendance.html → Settings → "Add a phone" (setWebhook).

   /start <code>   from the one-time link: adds this phone to the messages
   /today          today's attendance
   /now            who is in the hotel right now
   Anything from a phone that hasn't been added gets a polite no. */

import { timingSafeEqual } from "node:crypto";
import { q } from "./_lib/db.js";
import { getSettings, setSetting, today, dailySummary } from "./_lib/attendance.js";
import { webhookSecret, telegramReady } from "./_lib/telegram.js";
import { insideText, HELP } from "./_lib/att-text.js";
import { json, body, handle, only, clean } from "./_lib/http.js";

const same = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/* Answers go back in the webhook's own reply, which Telegram sends on. */
const reply = (res, chatId, text) => json(res, 200, { method: "sendMessage", chat_id: chatId, text, parse_mode: "HTML" });

export default handle(async (req, res) => {
  if (!only(req, res, "POST")) return;
  if (!telegramReady() || !same(String(req.headers["x-telegram-bot-api-secret-token"] || ""), webhookSecret())) return json(res, 401, { error: "secret" });

  const m = body(req).message;
  if (!m || !m.chat || m.chat.type !== "private" || typeof m.text !== "string") return json(res, 200, {});
  const chatId = String(m.chat.id);
  const text = m.text.trim();
  const set = await getSettings();
  const lang = set.lang === "ne" ? "ne" : "en";
  const [known] = await q(`SELECT active FROM telegram_chats WHERE chat_id = $1`, [chatId]);

  const start = /^\/start(?:\s+(\S+))?$/.exec(text);
  if (start && start[1]) {
    const [code, until] = String(set.tg_link || "").split("|");
    if (code && same(start[1], code) && Date.now() < Number(until)) {
      const name = clean([m.from && m.from.first_name, m.from && m.from.last_name].filter(Boolean).join(" ") || (m.from && m.from.username) || "Telegram", 80);
      await q(`INSERT INTO telegram_chats (chat_id, name) VALUES ($1, $2) ON CONFLICT (chat_id) DO UPDATE SET active = true, name = EXCLUDED.name`, [chatId, name]);
      await setSetting("tg_link", "");
      return reply(res, chatId, (lang === "ne" ? "✅ जोडियो। " : "✅ Connected. ") + HELP[lang]);
    }
    if (!known) return reply(res, chatId, "This link has expired or was already used. Make a new one on the attendance page (Settings → Add a phone).");
  }
  if (!known || !known.active) return reply(res, chatId, "This is Hotel Perfect Plaza's private staff bot.");

  if (/^\/?(today|aaja|आज)\b/i.test(text)) return reply(res, chatId, await dailySummary());
  if (/^\/?(now|ahile|अहिले)\b/i.test(text)) return reply(res, chatId, insideText(await today(), lang));
  return reply(res, chatId, HELP[lang]);
});
