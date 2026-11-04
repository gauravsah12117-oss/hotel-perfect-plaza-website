/* ==========================================================================
   Only for a fingerprint machine that can't use HTTPS.
   --------------------------------------------------------------------------
   The website only answers on https://, and some older ZKTeco/eSSL machines
   only speak plain http://. This runs on any computer at the hotel (same
   network as the machine), takes the machine's calls on plain http, and
   passes them on to the website over https, unchanged.

     1. Install Node.js (nodejs.org, the LTS version) on that computer.
     2. Double-click start-bridge.bat (it runs this file).
     3. On the machine, Cloud Server Setting: server address = this
        computer's IP address (shown when the bridge starts), port 8081,
        HTTPS off, domain name off.

   The computer must stay on while the bridge runs, and the bridge must be
   running for punches to arrive. The machine keeps punches it couldn't send
   and sends them later, so nothing is lost while the computer is off, only
   delayed (and messages for punches more than 15 minutes old come as one).

   SITE=https://… to change the website; PORT=… to change 8081.
   ========================================================================== */

import { createServer } from "node:http";
import { networkInterfaces } from "node:os";

const SITE = (process.env.SITE || "https://hotel-perfect-plaza-website.vercel.app").replace(/\/$/, "");
const PORT = +(process.env.PORT || 8081);

createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  try {
    const r = await fetch(SITE + req.url, {
      method: req.method,
      headers: { "Content-Type": req.headers["content-type"] || "text/plain", "User-Agent": req.headers["user-agent"] || "zk-bridge" },
      body: /^(GET|HEAD)$/.test(req.method) ? undefined : body,
      redirect: "follow"
    });
    const out = Buffer.from(await r.arrayBuffer());
    res.writeHead(r.status, { "Content-Type": r.headers.get("content-type") || "text/plain", "Content-Length": out.length });
    res.end(out);
    if (!/getrequest/.test(req.url)) console.log(new Date().toLocaleTimeString(), req.method, req.url.slice(0, 80), "→", r.status, out.toString().slice(0, 40).replace(/\s+/g, " "));
  } catch (e) {
    console.error(new Date().toLocaleTimeString(), "Can't reach the website:", e.message);
    res.writeHead(502); res.end("bridge: website unreachable");
  }
}).listen(PORT, () => {
  const ips = Object.values(networkInterfaces()).flat().filter(i => i && i.family === "IPv4" && !i.internal).map(i => i.address);
  console.log(`Fingerprint bridge running → ${SITE}`);
  console.log(`On the machine: server address ${ips.join(" or ")}, port ${PORT}, HTTPS off.`);
  console.log("Keep this window open.");
});
