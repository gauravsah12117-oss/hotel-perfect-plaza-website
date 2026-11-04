/* ==========================================================================
   Local test server: the site plus the booking API, on this computer.
   --------------------------------------------------------------------------
     npm install        (once)
     npm run dev        → http://localhost:3000

   Serves the folder as Vercel does, runs the files in /api the way Vercel
   runs them, and uses PGlite — real Postgres, running inside Node — in
   dev/.data instead of the Neon database. eSewa is in test mode; emails are
   only sent if RESEND_API_KEY is set. The admin password is "test" unless
   ADMIN_PASSWORD is set, and so is attendance.html's (ATTENDANCE_PASSWORD).
   A pretend fingerprint machine: node dev/fake-machine.mjs (see there).
   Nothing here is deployed (.vercelignore).

   Options:  PORT=3001   DB=memory (a fresh empty database each run)
   ========================================================================== */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { makeDriver } from "./pglite-driver.mjs";
import { useDriver } from "../api/_lib/db.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = +(process.env.PORT || 3000);
process.env.ADMIN_PASSWORD ??= "test";
process.env.ATTENDANCE_PASSWORD ??= "test";
process.env.ESEWA_MODE ??= "test";

useDriver(await makeDriver(process.env.DB === "memory" ? null : join(ROOT, "dev", ".data", "db")));

/* ESEWA_FAKE=complete: eSewa's status check answers COMPLETE for every
   payment, so booking.html's confirmation can be seen without paying on
   eSewa's test site (whose login has a CAPTCHA). Local testing only. */
if (process.env.ESEWA_FAKE) {
  const real = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes("/api/epay/transaction/status/")) {
      const p = new URL(url).searchParams;
      return new Response(JSON.stringify({ product_code: p.get("product_code"), transaction_uuid: p.get("transaction_uuid"),
        total_amount: Number(p.get("total_amount")), status: process.env.ESEWA_FAKE.toUpperCase(), ref_id: "0FAKE01" }));
    }
    return real(url, opts);
  };
  console.log("eSewa status check faked: " + process.env.ESEWA_FAKE.toUpperCase());
}

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".mp4": "video/mp4", ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8", ".xml": "application/xml" };

async function api(req, res, url, name = url.pathname.slice(5).replace(/\/$/, "")) {
  if (!/^[a-z0-9-]+$/.test(name)) { res.statusCode = 404; return res.end("not found"); }
  let mod;
  try { mod = await import(pathToFileURL(join(ROOT, "api", name + ".js")).href); }
  catch (e) { if (e.code !== "ERR_MODULE_NOT_FOUND") throw e; res.statusCode = 404; return res.end("not found"); }
  req.query = Object.fromEntries(url.searchParams);
  const chunks = []; for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (typeof mod.default !== "function") return web(mod[req.method], req, res, url, raw);
  req.body = raw && /json/.test(req.headers["content-type"] || "") ? JSON.parse(raw) : raw || undefined;
  await mod.default(req, res);
}

/* A route written as a Web handler (export function GET(request)), as
   api/iclock.js is: Request in, Response out. */
async function web(handler, req, res, url, raw) {
  if (typeof handler !== "function") { res.statusCode = 405; return res.end(); }
  const headers = Object.entries(req.headers).filter(([k, v]) => typeof v === "string" && !/^(host|connection|content-length|transfer-encoding|keep-alive)$/.test(k));
  const r = await handler(new Request(url, { method: req.method, headers, body: /^(GET|HEAD)$/.test(req.method) ? undefined : raw }));
  res.statusCode = r.status;
  r.headers.forEach((v, k) => res.setHeader(k, v));
  res.end(Buffer.from(await r.arrayBuffer()));
}

async function file(req, res, url) {
  let p = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "");
  if (p.includes("..")) { res.statusCode = 400; return res.end(); }
  let full = join(ROOT, p || "index.html");
  try { if ((await stat(full)).isDirectory()) full = join(full, "index.html"); }
  catch { res.statusCode = 404; return res.end("not found"); }
  const data = await readFile(full);
  const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
  res.setHeader("Content-Type", TYPES[extname(full).toLowerCase()] || "application/octet-stream");
  res.setHeader("Accept-Ranges", "bytes");
  if (range) {   /* video seeking */
    const start = range[1] ? +range[1] : 0, end = range[2] ? +range[2] : data.length - 1;
    res.statusCode = 206;
    res.setHeader("Content-Range", `bytes ${start}-${end}/${data.length}`);
    return res.end(data.subarray(start, end + 1));
  }
  res.end(data);
}

createServer(async (req, res) => {
  const url = new URL(req.url, "http://" + req.headers.host);
  /* vercel.json's rewrite: the fingerprint machine's /iclock/<op> */
  const iclock = /^\/iclock\/([A-Za-z.]+)$/.exec(url.pathname);
  if (iclock) url.searchParams.set("op", iclock[1]);
  try { await (iclock ? api(req, res, url, "iclock") : url.pathname.startsWith("/api/") ? api(req, res, url) : file(req, res, url)); }
  catch (e) { console.error(e); if (!res.headersSent) { res.statusCode = 500; res.end("error"); } }
}).listen(PORT, () => console.log(`Hotel Perfect Plaza (with booking) on http://localhost:${PORT}  — admin password: ${process.env.ADMIN_PASSWORD}`));
