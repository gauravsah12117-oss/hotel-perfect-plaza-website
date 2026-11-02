/* Keeps assets/js/i18n-ne.js in step with the pages.
     node dev/i18n-sync.mjs            lists English on the pages with no Nepali
     node dev/i18n-sync.mjs write      rewrites i18n-ne.js in page order, taking
                                       new Nepali from dev/.data/ne-add.json
   Needs dev/.data/strings.json: run dev/browser/extract.js on each page first
   (see README, "Translations"). */
import { readFileSync, writeFileSync } from "node:fs";
const mode = process.argv[2];
const file = "assets/js/i18n-ne.js";
const src = readFileSync(file, "utf8");
const window = {}; new Function("window", src)(window);
const dict = window.HPP_NE;
const page = JSON.parse(readFileSync("dev/.data/strings.json", "utf8"));
let add = {}; try { add = JSON.parse(readFileSync("dev/.data/ne-add.json", "utf8")); } catch {}
const KEEP = new Set(["WhatsApp", "hotelperfectplaza@gmail.com", "CC BY-SA 4.0", "CC BY-SA 2.0", "Hotel Perfect Plaza"]);
const LATER = ["Close menu", "Check the highlighted fields and send again.",
  "WhatsApp has opened with your enquiry written out — press Send there and it reaches us.",
  "Thank you — your enquiry is with us. We usually reply within a few hours.",
  "That did not send. Please", "message us on WhatsApp", "instead.", "Sending…"];
const missing = page.filter(k => !(k in dict) && !(k in add) && !KEEP.has(k));
if (mode !== "write") {
  console.log(page.length + " strings; missing Nepali: " + missing.length);
  missing.forEach(k => console.log("  " + JSON.stringify(k)));
  const gone = Object.keys(dict).filter(k => !page.includes(k) && !LATER.includes(k));
  console.log("in the dictionary but on no page: " + gone.length);
  gone.forEach(k => console.log("  " + JSON.stringify(k)));
  process.exit(0);
}
if (missing.length) { console.error("still missing: " + missing.join(" | ")); process.exit(1); }
const lines = [];
page.forEach(k => { if (KEEP.has(k) && !(k in dict)) return; const v = k in add ? add[k] : dict[k]; if (v !== undefined) lines.push("  " + JSON.stringify(k) + ": " + JSON.stringify(v) + ","); });
lines.push("", "  /* written later by main.js: the menu button, the enquiry form's messages */");
LATER.forEach(k => lines.push("  " + JSON.stringify(k) + ": " + JSON.stringify(dict[k]) + ","));
lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, "");
const head = src.slice(0, src.indexOf("window.HPP_NE = {") + "window.HPP_NE = {".length);
writeFileSync(file, head + "\n" + lines.join("\n") + "\n};\n", "utf8");
console.log("wrote " + (lines.length - 2) + " entries");
