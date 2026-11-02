/* Headless Chrome over CDP, for testing pages:
     CHROME_BIN=<chrome.exe> PAGE=<url> EXPR_FILE=<script.js> node dev/probe.mjs
   Opens PAGE at VW × VH, runs EXPR_FILE in it (an async expression whose
   value is printed), optionally saves a screenshot (SHOT=<file.png>), and
   lists any console errors. Also: INIT_SCRIPT=<file> runs before the page's
   own scripts; CALM=1 asks for reduced motion (smooth scrolling never
   finishes in headless Chrome here, so test section links with CALM=1). */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const W = +(process.env.VW || 1440), H = +(process.env.VH || 900);
const port = 9500 + Math.floor(Math.random() * 400), profile = mkdtempSync(join(tmpdir(), "cdp-"));
const chrome = spawn(process.env.CHROME_BIN || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", ["--headless=new", "--disable-gpu", "--hide-scrollbars",
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${W},${H}`, "about:blank"], { stdio: "ignore" });
const wait = ms => new Promise(r => setTimeout(r, ms));
let ep; for (let i = 0; i < 60; i++) { try { ep = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl; break; } catch { await wait(250); } }
const ws = new WebSocket(ep); await new Promise(r => ws.addEventListener("open", r, { once: true }));
let id = 0; const pend = new Map(); const problems = [];
ws.addEventListener("message", e => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
  if (m.method === "Log.entryAdded" && ["error", "warning"].includes(m.params.entry.level)) problems.push(m.params.entry.level + ": " + m.params.entry.text + (m.params.entry.url ? " (" + m.params.entry.url + ")" : ""));
  if (m.method === "Runtime.exceptionThrown") problems.push("EXCEPTION: " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
});
const send = (method, params = {}, sessionId) => new Promise(res => { const n = ++id; pend.set(n, res); ws.send(JSON.stringify({ id: n, method, params, sessionId })); });
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId: s } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, s);
await send("Page.bringToFront", {}, s);
await send("Emulation.setFocusEmulationEnabled", { enabled: true }, s);
await send("Log.enable", {}, s); await send("Runtime.enable", {}, s);
await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: W < 700, screenWidth: W, screenHeight: H }, s);
if (process.env.CALM) await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] }, s);
if (process.env.INIT_SCRIPT) await send("Page.addScriptToEvaluateOnNewDocument", { source: readFileSync(process.env.INIT_SCRIPT, "utf8") }, s);
await send("Page.navigate", { url: process.env.PAGE || "http://localhost:3000/" }, s);
await wait(+(process.env.LOAD_WAIT || 4000));
const r = await send("Runtime.evaluate", { expression: readFileSync(process.env.EXPR_FILE, "utf8"), returnByValue: true, awaitPromise: true }, s);
if (process.env.SHOT) {
  await wait(900);
  const shot = await send("Page.captureScreenshot", { format: "png" }, s);
  writeFileSync(process.env.SHOT, Buffer.from(shot.data, "base64"));
}
const v = r.result && r.result.value;
console.log(typeof v === "string" ? v : JSON.stringify(v, null, 1));
if (r.exceptionDetails) console.log("ERR", JSON.stringify(r.exceptionDetails).slice(0, 600));
console.log(problems.length ? "--- console problems: " + problems.join(" || ") : "--- console: clean ---");
const exited = new Promise(res => chrome.once("exit", res));
send("Browser.close").catch(() => {});
await Promise.race([exited, wait(6000)]);
try { ws.close(); } catch {}
if (chrome.exitCode === null) chrome.kill();
await Promise.race([exited, wait(3000)]);
for (let i = 0; i < 40 && existsSync(profile); i++) { try { rmSync(profile, { recursive: true, force: true }); } catch { await wait(250); } }
process.exit(0);
