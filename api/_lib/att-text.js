/* The words of the notifications (the app's, and Telegram's), in English
   (en) or Nepali (ne) — attendance.html → Settings chooses. Edit the Nepali
   here to improve it. */

import "../../assets/js/nepali-date.js";              /* globalThis.NepaliDate: the Nepali calendar */

const esc = s => String(s == null ? "" : s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const NE = "०१२३४५६७८९";
const neDigits = s => String(s).replace(/\d/g, d => NE[d]);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const NE_WD = ["आइतबार", "सोमबार", "मंगलबार", "बुधबार", "बिहीबार", "शुक्रबार", "शनिबार"];

/* t: Nepal wall time in ms, or "HH:MM" */
export function clock(t, lang = "en") {
  let h, m;
  if (typeof t === "string") [h, m] = t.split(":").map(Number);
  else { const d = new Date(t); h = d.getUTCHours(); m = d.getUTCMinutes(); }
  const mm = String(m).padStart(2, "0"), h12 = h % 12 || 12;
  if (lang !== "ne") return `${h12}:${mm} ${h < 12 ? "AM" : "PM"}`;
  const part = h < 4 ? "राति" : h < 12 ? "बिहान" : h < 16 ? "दिउँसो" : h < 20 ? "बेलुका" : "राति";
  return `${part} ${neDigits(h12 + ":" + mm)}`;
}

export function dur(min, lang = "en") {
  const h = Math.floor(min / 60), m = min % 60;
  if (lang === "ne") return [h ? neDigits(h) + " घण्टा" : "", m || !h ? neDigits(m) + " मिनेट" : ""].filter(Boolean).join(" ");
  return [h ? h + " h" : "", m || !h ? m + " min" : ""].filter(Boolean).join(" ");
}

/* "Thu 5 Nov (19 Kartik 2083)" / "बिहीबार, कात्तिक १९, २०८३" */
export function date(day, lang) {
  const d = new Date(day + "T00:00:00Z"), ND = globalThis.NepaliDate, b = ND && ND.toBS(day);
  if (lang === "ne") return b ? `${NE_WD[d.getUTCDay()]}, ${ND.MONTHS_NE[b.m - 1]} ${neDigits(b.d)}, ${neDigits(b.y)}` : `${NE_WD[d.getUTCDay()]}, ${neDigits(day)}`;
  return `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}` + (b ? ` (${b.d} ${ND.MONTHS[b.m - 1]} ${b.y})` : "");
}

const T = {
  en: {
    in: (n, c) => `✅ <b>${n}</b> came in at ${c}`,
    out: (n, c) => `🏠 <b>${n}</b> left at ${c}`,
    back: (n, c) => `↩️ <b>${n}</b> came back at ${c}`,
    late: d => `⏰ ${d} late`, onTime: "on time", holiday: "on a holiday", off: "on their day off",
    worked: d => `worked ${d}`, ot: d => `overtime ${d}`, early: d => `${d} early`,
    lateUpload: "📥 The fingerprint machine was offline. These punches have just come in:",
    more: n => `…and ${n} more`,
    title: "📋 <b>Attendance today</b>",
    counts: (p, l, a, v) => `Present ${p} · Late ${l} · Absent ${a}` + (v ? ` · On leave ${v}` : ""),
    absent: "❌ Absent", lateList: "⏰ Late", inside: "🟢 Still in", since: c => `since ${c}`,
    otList: "⏱ Overtime", missing: "⚠️ Forgot to punch out", leave: "🌴 On leave", holidayToday: h => `🎉 Holiday: ${h}`,
    machineOff: c => `⚠️ The fingerprint machine hasn't connected since ${c}. Check its power and internet.`,
    noMachine: "⚠️ No fingerprint machine is connected yet.",
    nobodyIn: "Nobody is in right now.", insideTitle: "🟢 <b>In the hotel now</b>",
    noStaff: "No staff added yet."
  },
  ne: {
    in: (n, c) => `✅ <b>${n}</b> ${c} मा आइपुगे`,
    out: (n, c) => `🏠 <b>${n}</b> ${c} मा गए`,
    back: (n, c) => `↩️ <b>${n}</b> ${c} मा फर्किए`,
    late: d => `⏰ ${d} ढिलो`, onTime: "समयमै", holiday: "बिदाको दिन", off: "साप्ताहिक बिदाको दिन",
    worked: d => `आज ${d} काम`, ot: d => `ओभरटाइम ${d}`, early: d => `${d} चाँडै`,
    lateUpload: "📥 फिंगरप्रिन्ट मेसिन अफलाइन थियो। यी हाजिरी भर्खर आए:",
    more: n => `…र अरू ${neDigits(n)}`,
    title: "📋 <b>आजको हाजिरी</b>",
    counts: (p, l, a, v) => `उपस्थित ${neDigits(p)} · ढिलो ${neDigits(l)} · अनुपस्थित ${neDigits(a)}` + (v ? ` · बिदामा ${neDigits(v)}` : ""),
    absent: "❌ अनुपस्थित", lateList: "⏰ ढिलो", inside: "🟢 अझै भित्र", since: c => `${c} देखि`,
    otList: "⏱ ओभरटाइम", missing: "⚠️ जाँदा औँला लगाउन बिर्से", leave: "🌴 बिदामा", holidayToday: h => `🎉 बिदा: ${h}`,
    machineOff: c => `⚠️ फिंगरप्रिन्ट मेसिन ${c} देखि जोडिएको छैन। बिजुली र इन्टरनेट जाँच्नुहोस्।`,
    noMachine: "⚠️ फिंगरप्रिन्ट मेसिन अझै जोडिएको छैन।",
    nobodyIn: "अहिले कोही पनि भित्र छैन।", insideTitle: "🟢 <b>अहिले होटलमा</b>",
    noStaff: "कर्मचारी थपिएको छैन।"
  }
};
const words = lang => T[lang] || T.en;

/* ev: { kind: in|out|back, name, staff, t, rec } from punchEvent() */
export function punchText(ev, lang) {
  const w = words(lang), r = ev.rec, n = esc(ev.name), c = clock(ev.t, lang);
  const notes = [];
  if (ev.staff.job) notes.push(esc(ev.staff.job));
  if (ev.kind === "in") {
    notes.push(r.holiday ? w.holiday : r.off ? w.off : r.late ? w.late(dur(r.late, lang)) : w.onTime);
    return w.in(n, c) + "\n" + notes.join(" · ");
  }
  if (ev.kind === "back") return w.back(n, c) + (notes.length ? "\n" + notes.join(" · ") : "");
  notes.push(w.worked(dur(r.worked, lang)));
  if (r.ot) notes.push(w.ot(dur(r.ot, lang)));
  if (r.early) notes.push(w.early(dur(r.early, lang)));
  return w.out(n, c) + "\n" + notes.join(" · ");
}

export function lateUploadText(list, lang) {
  const w = words(lang), shown = list.slice(0, 25);
  const lines = shown.map(p => `• ${esc(p.name)} — ${clock(p.t, lang)}`);
  if (list.length > shown.length) lines.push(w.more(list.length - shown.length));
  return w.lateUpload + "\n" + lines.join("\n");
}

/* t: today() from attendance.js; devs: the approved machines */
export function summaryText(t, devs, lang) {
  const w = words(lang), rows = t.rows;
  const name = r => esc(r.name);
  const pick = f => rows.filter(r => f(r.rec));
  const present = pick(r => r.punches.length > 0);
  const late = pick(r => r.late > 0), absent = pick(r => r.status === "absent"), leave = pick(r => r.status === "leave");
  const inside = pick(r => r.inside), ot = pick(r => r.ot > 0 && !r.inside), missing = pick(r => r.missing);
  const out = [`${w.title} — ${date(t.day, lang)}`];
  if (!rows.length) out.push(w.noStaff);
  else out.push(w.counts(present.length, late.length, absent.length, leave.length));
  const hol = rows.find(r => r.rec.holiday);
  if (hol) out.push(w.holidayToday(esc(hol.rec.holiday)));
  const list = (label, rs, f) => { if (rs.length) out.push(`${label}: ` + rs.map(f).join(", ")); };
  out.push("");
  list(w.absent, absent, name);
  list(w.lateList, late, r => `${name(r)} ${dur(r.rec.late, lang)}`);
  list(w.leave, leave, name);
  list(w.inside, inside, r => `${name(r)} (${w.since(clock(r.rec.in, lang))})`);
  list(w.otList, ot, r => `${name(r)} ${dur(r.rec.ot, lang)}`);
  list(w.missing, missing, name);
  if (!devs.length) out.push(w.noMachine);
  for (const d of devs) if (d.ago > 2 * 3600) out.push(w.machineOff(clock(d.last_seen.slice(11), lang) + (d.last_seen.slice(0, 10) === t.day ? "" : " " + date(d.last_seen.slice(0, 10), lang))));
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function insideText(t, lang) {
  const w = words(lang), inside = t.rows.filter(r => r.rec.inside);
  if (!inside.length) return w.nobodyIn;
  return w.insideTitle + "\n" + inside.map(r => `• ${esc(r.name)} — ${w.since(clock(r.rec.in, lang))}`).join("\n");
}

export const HELP = {
  en: "Hotel Perfect Plaza attendance.\nYou get a message each time a staff member punches in or out.\n\n/today — who came, who is late or absent\n/now — who is in the hotel right now",
  ne: "होटल पर्फेक्ट प्लाजा हाजिरी।\nकर्मचारीले औँला लगाउँदा तपाईंलाई सन्देश आउँछ।\n\n/today — आज को आयो, को ढिलो वा अनुपस्थित\n/now — अहिले होटलमा को छ"
};
