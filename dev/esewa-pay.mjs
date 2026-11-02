/* Pays one booking on eSewa's TEST system in headless Chrome, as a guest
   would, with eSewa's published test account — the only way to test the
   whole loop (site → eSewa → booking.html → confirmed) end to end.
     node dev/esewa-pay.mjs <file.html that auto-posts the eSewa form> [shot-prefix]
   Test account (developer.esewa.com.np): ID 9711111111, password Nepal@123,
   MPIN 1122, token 123456. Never point this at live mode. */
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const START = process.argv[2], SHOTS = process.argv[3] || null;
const port = 9500 + Math.floor(Math.random() * 400), profile = mkdtempSync(join(tmpdir(), "cdp-"));
const chrome = spawn(process.env.CHROME_BIN || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ["--headless=new", "--disable-gpu", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--window-size=1280,900", "about:blank"], { stdio: "ignore" });
const wait = ms => new Promise(r => setTimeout(r, ms));
let ep; for (let i = 0; i < 60; i++) { try { ep = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl; break; } catch { await wait(250); } }
const ws = new WebSocket(ep); await new Promise(r => ws.addEventListener("open", r, { once: true }));
let id = 0; const pend = new Map();
ws.addEventListener("message", e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } });
const send = (method, params = {}, sessionId) => new Promise(res => { const n = ++id; pend.set(n, res); ws.send(JSON.stringify({ id: n, method, params, sessionId })); });
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId: s } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, s); await send("Page.bringToFront", {}, s); await send("Runtime.enable", {}, s);
const ev = async expr => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, s)).result?.value;
const shot = async name => { if (!SHOTS) return; const r = await send("Page.captureScreenshot", { format: "png" }, s); writeFileSync(SHOTS + "-" + name + ".png", Buffer.from(r.data, "base64")); };
/* type into the first visible input matching a test, the way a person does */
const typeInto = async (test, text) => {
  const ok = await ev(`(() => { const i = [...document.querySelectorAll("input")].find(i => i.offsetParent && (${test})(i)); if (!i) return false; i.focus(); i.select && i.select(); return true; })()`);
  if (ok) await send("Input.insertText", { text }, s);
  return ok;
};
const click = async test => ev(`(() => { const b = [...document.querySelectorAll("button, input[type=submit], a")].find(b => b.offsetParent && (${test})((b.textContent || b.value || "").trim().toLowerCase())); if (!b) return false; b.click(); return true; })()`);

await send("Page.navigate", { url: START }, s);
const log = [];
for (let step = 0; step < 12; step++) {
  await wait(3500);
  const url = await ev("location.href");
  const text = (await ev("document.body ? document.body.innerText.replace(/\\s+/g,' ').slice(0,300) : ''")) || "";
  log.push(step + ": " + url.slice(0, 80) + " — " + text.slice(0, 140));
  await shot(String(step));
  if (/localhost|booking\.html/.test(url) && !/esewa/.test(url)) {
    await wait(6000);
    log.push("BACK ON THE SITE: " + (await ev("document.querySelector('[data-result]') ? document.querySelector('[data-result]').innerText.replace(/\\s+/g,' ').slice(0,400) : document.body.innerText.slice(0,300)")));
    await shot("result");
    break;
  }
  if (await ev(`!![...document.querySelectorAll("input")].find(i => i.offsetParent && /esewa id/i.test(i.placeholder))`)) {
    await typeInto(`i => /esewa id/i.test(i.placeholder)`, "9711111111");
    await typeInto(`i => i.type === "password"`, "Nepal@123");
    await click(`t => t === "login"`);
    continue;
  }
  if (/token|otp|verification code/i.test(text)) {
    await typeInto(`i => i.type !== "hidden"`, "123456");
    await click(`t => /verify|submit|continue|proceed|confirm/.test(t)`);
    continue;
  }
  if (/mpin/i.test(text) && await ev(`!![...document.querySelectorAll("input[type=password]")].find(i => i.offsetParent)`)) {
    await typeInto(`i => i.type === "password"`, "1122");
    await click(`t => /confirm|pay|continue|proceed|submit/.test(t)`);
    continue;
  }
  await click(`t => /^(confirm|confirm payment|pay|continue|proceed)/.test(t)`);
}
console.log(log.join("\n"));
const exited = new Promise(res => chrome.once("exit", res));
send("Browser.close").catch(() => {});
await Promise.race([exited, wait(6000)]);
try { ws.close(); } catch {}
if (chrome.exitCode === null) chrome.kill();
for (let i = 0; i < 40 && existsSync(profile); i++) { try { rmSync(profile, { recursive: true, force: true }); } catch { await wait(250); } }
process.exit(0);
