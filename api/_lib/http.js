/* Small helpers shared by the API routes. */

import { randomBytes } from "node:crypto";

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

/* Vercel parses JSON bodies into req.body; the local dev server does too.
   Accept a raw string as well, just in case. */
export function body(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === "string") { try { return JSON.parse(b); } catch { return {}; } }
  return b;
}

/* The site's own address, for eSewa's return links: whichever domain the
   guest is on (the hotel's domain, or a Vercel preview). */
export function origin(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || (/^(localhost|127\.)/.test(host || "") ? "http" : "https");
  return proto.split(",")[0] + "://" + host;
}

/* A booking reference a guest can read out on the phone: HPP- and six
   characters, without 0/O or 1/I. */
const ABC = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export function bookingId() {
  const bytes = randomBytes(6);
  return "HPP-" + Array.from(bytes, x => ABC[x % ABC.length]).join("");
}

/* eSewa's transaction id: unique per payment attempt; letters, digits and
   hyphens only. */
export const transactionUuid = id => id + "-" + Date.now().toString(36).toUpperCase() + randomBytes(2).toString("hex").toUpperCase();

export const clean = (s, max = 200) => String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
export const cleanText = (s, max = 1000) => String(s == null ? "" : s).replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ").trim().slice(0, max);

export function only(req, res, ...methods) {
  if (methods.includes(req.method)) return true;
  res.setHeader("Allow", methods.join(", "));
  json(res, 405, { error: "method" });
  return false;
}

/* Turns any thrown error into a JSON reply, so the page always gets an answer. */
export const handle = fn => async (req, res) => {
  try { await fn(req, res); }
  catch (e) {
    console.error(e);
    const setup = e && (e.code === "NO_DB" || e.code === "NO_ESEWA");
    json(res, setup ? 503 : 500, { error: setup ? "setup" : "server" });
  }
};
