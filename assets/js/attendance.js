/* attendance.html — the owner's staff attendance page. Talks to
   /api/attendance with the password signed in with (kept for this browser
   tab only). The Daily tab refreshes itself every 30 seconds. */

(function () {
  "use strict";
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const KEY = "hpp-attendance";
  let pass = null;
  try { pass = sessionStorage.getItem(KEY); } catch (e) {}

  /* ------------------------------------------------------------ helpers */
  const today = () => new Date(Date.now() + 345 * 60000).toISOString().slice(0, 10);   /* Nepal, UTC+5:45 */
  const addDays = (s, n) => new Date(Date.parse(s + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
  const monthEnd = m => addDays(addDays(m + "-01", 32).slice(0, 7) + "-01", -1);
  const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const nice = d => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const rs = n => "Rs " + Math.round(Number(n) || 0).toLocaleString("en-IN");
  const clock = s => { if (!s) return ""; const [h, m] = s.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
  const dur = min => { if (!min) return "—"; const h = Math.floor(min / 60), m = min % 60; return (h ? h + "h " : "") + (m || !h ? m + "m" : "").trim(); };
  const hours = min => (min / 60).toFixed(1);
  const msg = (el, text, ok) => { el.textContent = text || ""; el.className = "msg" + (el.classList.contains("wide") ? " wide" : "") + (text ? (ok ? " ok" : " bad") : ""); };
  const ERR = { pin: "Choose a staff member (or check the machine number).", time: "That date or time isn't right.", future: "That time hasn't happened yet.",
    exists: "There is already a punch at exactly that time.", shift: "Give both shift times, or leave both empty.", money: "Check the salary and overtime amounts.",
    dates: "Check the dates (at most 62 days at once).", telegram: "TELEGRAM_BOT_TOKEN isn't set in Vercel yet (ATTENDANCE.md, step 2).",
    webhook: "Telegram didn't accept the website's address. This only works on the real website, not on this computer.", setting: "Check the highlighted numbers." };
  const errText = r => ERR[r.json.error] || "Something went wrong. Try again.";

  function el(tag, props, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (k === "className" || k === "textContent" || k === "title" || k === "value" || k === "href") e[k] = v;
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) e.append(kid instanceof Node ? kid : String(kid));
    return e;
  }
  /* head: ["Name", ["Worked", "num"]…]; rows: arrays of cells: text, a node,
     or { v, cls }; rowProps per row (optional) */
  function fill(table, head, rows, { foot, rowProps } = {}) {
    table.textContent = "";
    const th = h => Array.isArray(h) ? el("th", { className: h[1] }, h[0]) : el("th", {}, h);
    const td = c => c && typeof c === "object" && !(c instanceof Node) && !Array.isArray(c) ? el("td", { className: c.cls }, c.v) : el("td", {}, c);
    table.append(el("thead", {}, el("tr", {}, head.map(th))));
    const body = el("tbody");
    if (!rows.length) body.append(el("tr", {}, el("td", { colspan: head.length, className: "muted" }, "Nothing here yet.")));
    rows.forEach((r, i) => body.append(el("tr", rowProps ? rowProps(i) : {}, r.map(td))));
    table.append(body);
    if (foot) table.append(el("tfoot", {}, el("tr", {}, foot.map(td))));
  }
  const btn = (text, onclick, cls = "btn btn--small btn--plain") => el("button", { type: "button", className: cls, onclick }, text);

  async function api(action, { method = "GET", query = {}, body } = {}) {
    const res = await fetch("/api/attendance?" + new URLSearchParams({ action, ...query }), {
      method, headers: { Authorization: "Bearer " + pass, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    let json = {}; try { json = await res.json(); } catch (e) {}
    if (res.status === 401) { signOut("Wrong password."); throw new Error("password"); }
    if (res.status === 503 && json.error === "setup") { signOut("Attendance isn't set up yet: ATTENDANCE_PASSWORD or the database is missing in Vercel."); throw new Error("setup"); }
    return { ok: res.ok, status: res.status, json };
  }
  const post = (action, body) => api(action, { method: "POST", body });

  /* ------------------------------------------------------------ sign in */
  let timer = null;
  function signOut(text) {
    pass = null; try { sessionStorage.removeItem(KEY); } catch (e) {}
    clearInterval(timer);
    $("[data-app]").hidden = true; $("[data-login]").hidden = false; $("[data-logout]").hidden = true; $("[data-machine-pill]").hidden = true;
    msg($("[data-login-msg]"), text || "");
  }
  async function start() {
    $("[data-login]").hidden = true; $("[data-app]").hidden = false; $("[data-logout]").hidden = false;
    const t = today();
    $("[data-day-date]").value ||= t;
    $("[data-rep-month]").value ||= t.slice(0, 7);
    $("[data-rep-from]").value ||= t.slice(0, 8) + "01";
    $("[data-rep-to]").value ||= monthEnd(t.slice(0, 7));
    $("[data-pun-from]").value ||= addDays(t, -6);
    $("[data-pun-to]").value ||= t;
    $("[data-lv-from]").value ||= t.slice(0, 8) + "01";
    $("[data-lv-to]").value ||= addDays(t, 90);
    $("[data-punch-form]").day.value ||= t;
    $("[data-leave-form]").from.value ||= t;
    await loadStaff();
    show((location.hash.slice(1) || "day"));
    clearInterval(timer);
    timer = setInterval(() => { if (pass && current === "day" && $("[data-day-date]").value === today() && !document.hidden) loadDay().catch(() => {}); }, 30000);
  }
  $("[data-login]").addEventListener("submit", async e => {
    e.preventDefault();
    pass = $("#pw").value;
    try {
      const r = await api("staff");
      if (r.ok) { try { sessionStorage.setItem(KEY, pass); } catch (err) {} start(); }
    } catch (err) { /* message already shown */ }
  });
  $("[data-logout]").addEventListener("click", () => signOut(""));

  /* --------------------------------------------------------------- tabs */
  let current = "day";
  const loaders = { day: () => loadDay(), report: () => loadReport(), punches: () => loadPunches(), staff: () => loadStaff(), leave: () => loadLeave(), settings: () => loadSettings() };
  function show(tab) {
    if (!loaders[tab]) tab = "day";
    current = tab;
    $$("[data-tab]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
    $$("[data-panel]").forEach(p => { p.hidden = p.dataset.panel !== tab; });
    try { history.replaceState(null, "", "#" + tab); } catch (e) {}
    loaders[tab]().catch(e => console.error(e));
  }
  $$("[data-tab]").forEach(b => b.addEventListener("click", () => show(b.dataset.tab)));

  /* ------------------------------------------------------------- staff */
  let staff = [];
  async function loadStaff() {
    const r = await api("staff");
    staff = r.json.staff || [];
    const name = s => s.name || "Staff #" + s.pin;
    $$("[data-staff-select]").forEach(sel => {
      const was = sel.value; sel.textContent = "";
      sel.append(el("option", { value: "" }, "Choose…"));
      staff.filter(s => s.active).forEach(s => sel.append(el("option", { value: s.pin }, `${name(s)} (no. ${s.pin})`)));
      sel.value = was;
    });
    const f = $("[data-pun-staff]"), was = f.value;
    f.textContent = ""; f.append(el("option", { value: "" }, "Everyone"));
    staff.forEach(s => f.append(el("option", { value: s.pin }, name(s))));
    f.value = was;
    fill($("[data-staff-table]"), [["No.", "num"], "Name", "Job", "Shift", "Day off", ["Salary", "num"], "Messages", "", ["Punches", "num"], ""],
      staff.map(s => [
        { v: s.pin, cls: "num" },
        { v: s.name || el("span", { className: "warn" }, "No name yet"), cls: "name" },
        s.job, s.shift_start ? `${clock(s.shift_start)} – ${clock(s.shift_end)}` : el("span", { className: "muted" }, "usual hours"),
        s.weekly_off == null ? "—" : DAYS[s.weekly_off],
        { v: s.salary ? rs(s.salary) : "—", cls: "num" },
        s.notify ? "On" : el("span", { className: "muted" }, "Off"),
        s.active ? "" : el("span", { className: "chip off" }, "Left"),
        { v: s.punches, cls: "num" },
        btn("Edit", () => editStaff(s))
      ]), { rowProps: i => staff[i].active ? {} : { className: "muted" } });
  }
  function editStaff(s) {
    const f = $("[data-staff-form]");
    for (const k of ["pin", "name", "job", "phone", "shift_start", "shift_end", "joined"]) f[k].value = s[k] || "";
    f.weekly_off.value = s.weekly_off == null ? "" : String(s.weekly_off);
    f.salary.value = s.salary || ""; f.ot_rate.value = s.ot_rate || "";
    f.notify.checked = s.notify; f.active.checked = s.active;
    f.pin.readOnly = true;
    $("[data-staff-form-title]").textContent = "Edit " + (s.name || "Staff #" + s.pin);
    msg($("[data-staff-msg]"), "");
    f.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  $("[data-staff-new]").addEventListener("click", () => {
    const f = $("[data-staff-form]");
    f.pin.readOnly = false;
    $("[data-staff-form-title]").textContent = "Add staff";
    setTimeout(() => { f.notify.checked = true; f.active.checked = true; });
  });
  $("[data-staff-form]").addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target, m = $("[data-staff-msg]");
    const isNew = !f.pin.readOnly && staff.some(s => s.pin === f.pin.value.trim());
    if (isNew) return msg(m, `Machine no. ${f.pin.value} is already in the list. Use its Edit button.`);
    const r = await post("staff", {
      pin: f.pin.value.trim(), name: f.name.value, job: f.job.value, phone: f.phone.value,
      shift_start: f.shift_start.value, shift_end: f.shift_end.value, weekly_off: f.weekly_off.value,
      salary: f.salary.value, ot_rate: f.ot_rate.value, joined: f.joined.value, notify: f.notify.checked, active: f.active.checked
    });
    if (!r.ok) return msg(m, errText(r));
    msg(m, "Saved.", true);
    await loadStaff();
    const s = staff.find(x => x.pin === f.pin.value.trim());
    if (s) editStaff(s);
  });

  /* -------------------------------------------------------------- daily */
  const LEAVE = { paid: "Paid leave", sick: "Sick leave", unpaid: "Unpaid leave" };
  function chips(rec, isToday) {
    const out = [];
    const c = (cls, text) => out.push(el("span", { className: "chip " + cls }, text), " ");
    if (rec.inside) c("inside", "In now");
    else if (rec.status === "present") c("present", "Present");
    else if (rec.status === "late") c("late", "Late");
    else if (rec.status === "half") c("half", "Half day");
    else if (rec.status === "absent") c("absent", isToday ? "Not come" : "Absent");
    else if (rec.status === "leave") c("leave", LEAVE[rec.leave] || "Leave");
    else if (rec.status === "holiday") c("holiday", rec.holiday);
    else if (rec.status === "off") c("off", "Day off");
    else if (rec.holiday) c("holiday", rec.holiday);                  /* planned, for a day still to come */
    else if (rec.leave) c("leave", LEAVE[rec.leave] || "Leave");
    else if (rec.off) c("off", "Day off");
    else if (rec.status === "upcoming") c("upcoming", isToday ? "Not yet due" : "—");
    else if (rec.status === "none") c("none", "Not joined");
    if (rec.inside && rec.late) c("late", "Late");
    if (rec.punches.length && rec.holiday) c("holiday", "Worked: " + rec.holiday);
    else if (rec.punches.length && rec.off) c("off", "Worked on day off");
    if (rec.missing) c("missing", "No punch out");
    if (rec.manual) c("manual", "by hand");
    return out;
  }
  const times = rec => rec.punches.map(p => clock(p.time) + (p.manual ? " ✎" : "")).join(" · ");

  async function loadDay() {
    const d = $("[data-day-date]").value || today();
    const isToday = d === today();
    let rows;
    if (isToday) {
      const r = await api("today");
      rows = r.json.rows;
      setup(r.json);
      machinePill(r.json.machines);
    } else {
      const r = await api("report", { query: { from: d, to: d } });
      rows = r.json.staff.map(s => ({ pin: s.pin, name: s.displayName, job: s.job, rec: s.days[0] }));
      $("[data-setup]").hidden = true;
    }
    $("[data-day-title]").textContent = isToday ? "Today, " + nice(d) : nice(d);
    $("[data-live]").hidden = !isToday;
    const n = f => rows.filter(r => f(r.rec)).length;
    const otTotal = rows.reduce((a, r) => a + r.rec.ot, 0);
    const tiles = $("[data-tiles]"); tiles.textContent = "";
    const tile = (cls, num, label) => tiles.append(el("div", { className: "tile " + cls }, el("b", {}, num), el("span", {}, label)));
    if (isToday) tile("in", n(r => r.inside), "In now");
    tile("", n(r => r.punches.length > 0), "Came");
    tile("late", n(r => r.late > 0), "Late");
    tile("absent", n(r => r.status === "absent"), isToday ? "Not come" : "Absent");
    tile("", n(r => r.status === "leave"), "On leave");
    tile("", dur(otTotal), "Overtime");

    fill($("[data-day-table]"), ["Staff", "In", "Out", "", ["Worked", "num"], ["Late", "num"], ["Left early", "num"], ["Overtime", "num"], "Shift", "Punches"],
      rows.map(r => {
        const x = r.rec;
        return [
          { v: [r.name, r.job ? el("small", {}, r.job) : null], cls: "name" },
          clock(x.in) || "—", x.inside ? el("span", { className: "good" }, "still in") : clock(x.out) || "—",
          { v: chips(x, isToday) },
          { v: dur(x.worked), cls: "num" },
          { v: x.late ? dur(x.late) : "—", cls: "num" + (x.late ? " warn" : "") },
          { v: x.early ? dur(x.early) : "—", cls: "num" + (x.early ? " warn" : "") },
          { v: x.ot ? dur(x.ot) : "—", cls: "num" + (x.ot ? " good" : "") },
          x.off || x.holiday ? el("span", { className: "muted" }, "day off") : `${clock(x.shiftStart)}–${clock(x.shiftEnd)}`,
          { v: times(x), cls: "times" }
        ];
      }));
    $("[data-day-hint]").textContent = isToday
      ? "Updates by itself every 30 seconds. A night shift's day is the day it started. ✎ = added by hand."
      : "✎ = added by hand. Fix a forgotten punch in the Punches tab.";
  }
  $("[data-day-date]").addEventListener("change", () => loadDay());

  function setup(t) {
    const items = [];
    const go = (text, tab) => items.push(el("li", {}, text, " ", el("button", { type: "button", className: "link", onclick: () => show(tab) }, "Open")));
    const approved = t.machines.filter(m => m.approved), waiting = t.machines.filter(m => !m.approved);
    if (!t.machines.length) go("No fingerprint machine has connected yet. See \"How to connect the machine\".", "settings");
    waiting.forEach(m => go(`A fingerprint machine (${m.sn}) is waiting for you to approve it.`, "settings"));
    if (!t.telegram) items.push(el("li", {}, "Telegram messages are off: TELEGRAM_BOT_TOKEN isn't set in Vercel yet (ATTENDANCE.md, step 2)."));
    else if (!t.phones) go("No phone gets the arrival messages yet. Settings → Add a phone.", "settings");
    const unnamed = t.rows.filter(r => /^Staff #/.test(r.name)).length;
    if (unnamed) go(`${unnamed} staff member${unnamed > 1 ? "s have" : " has"} no name yet.`, "staff");
    if (approved.some(m => m.clock_fast)) go("The machine's clock is fast. Set the right time on the machine (Menu → System → Date Time).", "settings");
    $("[data-setup-list]").textContent = "";
    $("[data-setup-list]").append(...items);
    $("[data-setup]").hidden = !items.length;
  }

  function machinePill(machines) {
    const p = $("[data-machine-pill]"), m = machines.filter(x => x.approved);
    p.hidden = !m.length;
    if (!m.length) return;
    const off = m.filter(x => x.ago > 3600);
    p.className = "pill " + (off.length ? "off" : "on");
    p.textContent = off.length ? "Machine offline since " + clock(off[0].last_seen.slice(11)) + (off[0].last_seen.slice(0, 10) !== today() ? " " + nice(off[0].last_seen.slice(0, 10)) : "") : "Machine online";
  }

  /* ------------------------------------------------------------- report */
  let report = null;
  $("[data-rep-month]").addEventListener("change", e => {
    if (!e.target.value) return;
    $("[data-rep-from]").value = e.target.value + "-01";
    $("[data-rep-to]").value = monthEnd(e.target.value);
    loadReport();
  });
  ["[data-rep-from]", "[data-rep-to]"].forEach(s => $(s).addEventListener("change", () => { $("[data-rep-month]").value = ""; loadReport(); }));

  async function loadReport() {
    const r = await api("report", { query: { from: $("[data-rep-from]").value, to: $("[data-rep-to]").value } });
    report = r.json;
    const span = Math.round((Date.parse(report.to) - Date.parse(report.from)) / 86400000) + 1;
    const wholeMonth = span >= 28;
    $("[data-rep-note]").textContent = `${nice(report.from)} – ${nice(report.to)}, ${span} days` + (wholeMonth ? "" : ". Pay is only shown for a whole month.");
    const head = ["Staff", ["Present", "num"], ["Half day", "num"], ["Absent", "num"], ["Paid leave", "num"], ["Unpaid leave", "num"], ["Off & holidays", "num"],
      ["Late (times)", "num"], ["Late (total)", "num"], ["Hours worked", "num"], ["Overtime (h)", "num"], ["Overtime pay", "num"], ["Unpaid days", "num"], ["Salary", "num"]];
    if (wholeMonth) head.push(["Pay", "num"]);
    const S = report.staff;
    const n = (v, cls = "") => ({ v: v || v === 0 ? v : "—", cls: "num " + cls });
    const tot = k => S.reduce((a, s) => a + s.summary[k], 0);
    const rows = S.map(s => {
      const x = s.summary, row = [
        { v: [s.displayName, s.job ? el("small", {}, s.job) : null], cls: "name" },
        n(x.present), n(x.half || "—"), n(x.absent || "—", x.absent ? "bad" : ""), n(x.paidLeave || "—"), n(x.unpaidLeave || "—"), n(x.off + x.holiday || "—"),
        n(x.late || "—", x.late ? "warn" : ""), n(x.lateMin ? dur(x.lateMin) : "—"), n(hours(x.worked)), n(x.ot ? hours(x.ot) : "—", x.ot ? "good" : ""),
        n(x.otPay ? rs(x.otPay) : "—"), n(x.unpaidDays || "—"), n(s.salary ? rs(s.salary) : "—")
      ];
      if (wholeMonth) row.push(n(s.salary ? rs(x.pay) : "—", "good"));
      return row;
    });
    const foot = ["Total", n(tot("present")), "", n(tot("absent")), "", "", "", n(tot("late")), "", n(hours(tot("worked"))), n(hours(tot("ot"))), n(rs(tot("otPay"))), "", n(rs(S.reduce((a, s) => a + (s.salary || 0), 0)))];
    if (wholeMonth) foot.push(n(rs(tot("pay"))));
    fill($("[data-rep-table]"), head, rows, { foot: S.length ? foot : null, rowProps: i => ({ className: "click", title: "See every day", onclick: () => detail(S[i]) }) });
    $("[data-rep-detail]").hidden = true;
  }

  function detail(s) {
    $("[data-rep-detail-title]").textContent = `${s.displayName}: every day`;
    fill($("[data-rep-detail-table]"), ["Date", "In", "Out", ["Worked", "num"], ["Late", "num"], ["Left early", "num"], ["Overtime", "num"], "", "Punches"],
      s.days.map(x => [
        nice(x.day), clock(x.in) || "—", x.inside ? "still in" : clock(x.out) || "—",
        { v: dur(x.worked), cls: "num" }, { v: x.late ? dur(x.late) : "—", cls: "num" + (x.late ? " warn" : "") },
        { v: x.early ? dur(x.early) : "—", cls: "num" }, { v: x.ot ? dur(x.ot) : "—", cls: "num" + (x.ot ? " good" : "") },
        { v: chips(x, x.day === today()) }, { v: times(x), cls: "times" }
      ]));
    $("[data-rep-detail]").hidden = false;
    $("[data-rep-detail]").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  $("[data-rep-detail-close]").addEventListener("click", () => { $("[data-rep-detail]").hidden = true; });
  $("[data-rep-print]").addEventListener("click", () => window.print());

  const STATUS = { present: "Present", late: "Late", half: "Half day", absent: "Absent", leave: "Leave", holiday: "Holiday", off: "Day off", upcoming: "", none: "Not joined" };
  $("[data-rep-csv]").addEventListener("click", () => {
    if (!report) return;
    const q = v => { v = v == null ? "" : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const lines = [[`Hotel Perfect Plaza staff attendance ${report.from} to ${report.to}`], [],
      ["No.", "Name", "Job", "Present", "Half days", "Absent", "Paid leave", "Unpaid leave", "Days off", "Holidays", "Late (times)", "Late (minutes)",
       "Hours worked", "Overtime (hours)", "Overtime pay", "Unpaid days", "Deduction", "Salary", "Pay"]];
    report.staff.forEach(s => { const x = s.summary; lines.push([s.pin, s.displayName, s.job, x.present, x.half, x.absent, x.paidLeave, x.unpaidLeave, x.off, x.holiday,
      x.late, x.lateMin, hours(x.worked), hours(x.ot), x.otPay, x.unpaidDays, x.deduction, s.salary, x.pay]); });
    lines.push([], ["Every day"], ["No.", "Name", "Date", "Day", "Status", "In", "Out", "Worked (min)", "Late (min)", "Left early (min)", "Overtime (min)", "Punches", "Added by hand"]);
    report.staff.forEach(s => s.days.forEach(x => lines.push([s.pin, s.displayName, x.day, WD[new Date(x.day + "T00:00:00Z").getUTCDay()],
      x.status === "leave" ? LEAVE[x.leave] : x.status === "holiday" ? x.holiday : STATUS[x.status], x.in, x.out, x.worked, x.late, x.early, x.ot,
      x.punches.map(p => p.time).join(" "), x.manual ? "yes" : ""])));
    const blob = new Blob(["﻿" + lines.map(l => l.map(q).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = el("a", { href: URL.createObjectURL(blob), download: `attendance-${report.from}-to-${report.to}.csv` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });

  /* ------------------------------------------------------------ punches */
  const HOW = { 0: "Password", 1: "Fingerprint", 2: "Card", 3: "Password", 4: "Card", 15: "Face", 25: "Palm" };
  async function loadPunches() {
    const r = await api("punches", { query: { from: $("[data-pun-from]").value, to: $("[data-pun-to]").value, pin: $("[data-pun-staff]").value } });
    const P = r.json.punches || [];
    fill($("[data-pun-table]"), ["When", "Staff", "How", "Note", ""], P.map(p => [
      `${nice(p.at.slice(0, 10))}, ${clock(p.at.slice(11, 16))}`,
      { v: (p.name || "Staff #" + p.pin) + " (" + p.pin + ")", cls: "name" },
      p.source === "manual" ? el("span", { className: "chip manual" }, "by hand") : HOW[p.verify] || "Machine",
      p.note,
      [btn(p.ignored ? "Put back" : "Leave out", async () => { await post("punch-ignore", { id: p.id, ignored: !p.ignored }); loadPunches(); }),
       p.source === "manual" ? btn("Delete", async () => { if (confirm("Delete this punch added by hand?")) { await post("punch-delete", { id: p.id }); loadPunches(); } }, "btn btn--small") : null]
    ]), { rowProps: i => P[i].ignored ? { className: "ignored", title: "Left out of the sums" } : { title: "Received " + P[i].received } });
    msg($("[data-pun-msg]"), P.length >= 3000 ? "Showing the latest 3,000. Choose fewer days to see the rest." : "");
  }
  ["[data-pun-from]", "[data-pun-to]", "[data-pun-staff]"].forEach(s => $(s).addEventListener("change", () => loadPunches()));
  $("[data-punch-form]").addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target, m = $("[data-punch-msg]");
    const r = await post("punch", { pin: f.pin.value, day: f.day.value, time: f.time.value, note: f.note.value });
    if (!r.ok) return msg(m, errText(r));
    msg(m, "Added.", true);
    f.time.value = ""; f.note.value = "";
    loadPunches();
  });

  /* -------------------------------------------------------------- leave */
  async function loadLeave() {
    const r = await api("leave", { query: { from: $("[data-lv-from]").value, to: $("[data-lv-to]").value } });
    fill($("[data-lv-table]"), ["Date", "Staff", "Kind", "Note", ""], r.json.leave.map(l => [
      nice(l.day), l.name || "Staff #" + l.pin, LEAVE[l.kind], l.note,
      btn("Remove", async () => { await post("leave", { pin: l.pin, from: l.day, kind: "none" }); loadLeave(); })
    ]));
    fill($("[data-hol-table]"), ["Date", "Holiday", ""], r.json.holidays.map(h => [
      nice(h.day), h.name, btn("Remove", async () => { await post("holiday", { day: h.day, remove: true }); loadLeave(); })
    ]));
  }
  ["[data-lv-from]", "[data-lv-to]"].forEach(s => $(s).addEventListener("change", () => loadLeave()));
  $("[data-leave-form]").addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target, m = $("[data-leave-msg]");
    const r = await post("leave", { pin: f.pin.value, from: f.from.value, to: f.to.value || f.from.value, kind: f.kind.value, note: f.note.value });
    if (!r.ok) return msg(m, errText(r));
    msg(m, f.kind.value === "none" ? "Leave removed." : "Saved.", true);
    loadLeave();
  });
  $("[data-hol-form]").addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target, m = $("[data-hol-msg]");
    const r = await post("holiday", { day: f.day.value, name: f.name.value });
    if (!r.ok) return msg(m, errText(r));
    msg(m, "Added.", true);
    f.reset(); loadLeave();
  });

  /* ----------------------------------------------------------- settings */
  async function loadSettings() {
    const r = await api("settings");
    const j = r.json, f = $("[data-set-form]");
    for (const [k, v] of Object.entries(j.settings)) {
      if (!f[k]) continue;
      if (f[k].type === "checkbox") f[k].checked = v === "1"; else f[k].value = v;
    }
    const tg = $("[data-tg-status]"); tg.textContent = "";
    tg.append(j.telegram.ready
      ? el("p", {}, "Bot: ", el("strong", {}, j.telegram.bot ? "@" + j.telegram.bot : "(couldn't reach Telegram)"), ". Every phone below gets a message the moment someone punches.")
      : el("p", { className: "bad" }, "Not set up: add TELEGRAM_BOT_TOKEN in Vercel (ATTENDANCE.md, step 2), then come back here."));
    $("[data-tg-link]").disabled = $("[data-tg-test]").disabled = !j.telegram.ready;
    fill($("[data-chat-table]"), ["Phone (Telegram name)", "Added", "", ""], j.chats.map(c => [
      { v: c.name, cls: "name" }, nice(c.added), c.active ? el("span", { className: "chip present" }, "Gets messages") : el("span", { className: "chip off" }, "Paused"),
      [btn(c.active ? "Pause" : "Resume", async () => { await post("chat", { chat_id: c.chat_id, active: !c.active }); loadSettings(); }),
       btn("Remove", async () => { if (confirm(`Stop sending messages to ${c.name}?`)) { await post("chat", { chat_id: c.chat_id, remove: true }); loadSettings(); } }, "btn btn--small")]
    ]));
    $("[data-dev-host]").textContent = j.server.host || location.host;
    fill($("[data-dev-table]"), ["Machine (serial no.)", "Status", "Last connected", "Clock", ""], j.machines.map(m => [
      { v: [m.name || m.sn, m.name ? el("small", {}, m.sn) : null], cls: "name" },
      m.approved ? (m.ago > 3600 ? el("span", { className: "chip absent" }, "Offline") : el("span", { className: "chip present" }, "Online"))
        : el("span", { className: "chip late" }, "Waiting for approval"),
      `${nice(m.last_seen.slice(0, 10))}, ${clock(m.last_seen.slice(11))}`,
      m.clock_fast ? el("span", { className: "bad" }, `${m.clock_fast} min fast`) : "OK",
      [m.approved ? btn("Stop", async () => { if (confirm("Stop taking punches from this machine?")) { await post("device", { sn: m.sn, approved: false }); loadSettings(); } })
                  : btn("Approve", async () => { await post("device", { sn: m.sn, approved: true }); loadSettings(); }, "btn btn--small btn--plain good"),
       btn("Name", async () => { const n = prompt("A name for this machine (e.g. Staff entrance)", m.name); if (n != null) { await post("device", { sn: m.sn, name: n }); loadSettings(); } }),
       btn("Remove", async () => { if (confirm("Remove this machine from the list? It will appear again, waiting for approval, the next time it connects.")) { await post("device", { sn: m.sn, remove: true }); loadSettings(); } }, "btn btn--small")]
    ]));
    $("[data-dev-howto]").open = !j.machines.length;
    machinePill(j.machines);
  }
  $("[data-set-form]").addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target, m = $("[data-set-msg]"), settings = {};
    for (const k of ["notify_in", "notify_out", "notify_summary"]) settings[k] = f[k].checked ? "1" : "0";
    for (const k of ["lang", "shift_start", "shift_end", "grace", "ot_min", "ot_multiplier"]) settings[k] = f[k].value;
    const r = await post("settings", { settings });
    if (!r.ok) { msg(m, errText(r)); if (r.json.key && f[r.json.key]) f[r.json.key].focus(); return; }
    msg(m, "Saved.", true);
  });
  $("[data-tg-link]").addEventListener("click", async () => {
    const m = $("[data-tg-msg]");
    msg(m, "Making a link…", true);
    const r = await post("telegram-link");
    if (!r.ok) return msg(m, errText(r) + (r.json.detail ? ` (${r.json.detail})` : ""));
    msg(m, "");
    const a = $("[data-tg-url]"); a.href = r.json.link; a.textContent = r.json.link;
    $("[data-tg-linkbox]").hidden = false;
  });
  $("[data-tg-copy]").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("[data-tg-url]").href); msg($("[data-tg-msg]"), "Link copied.", true); }
    catch (e) { msg($("[data-tg-msg]"), "Couldn't copy. Press and hold the link instead."); }
  });
  $("[data-tg-refresh]").addEventListener("click", () => loadSettings());
  $("[data-tg-test]").addEventListener("click", async () => {
    const r = await post("telegram-test");
    msg($("[data-tg-msg]"), r.ok ? (r.json.sent ? `Sent to ${r.json.sent} phone${r.json.sent > 1 ? "s" : ""}.` : "No phone to send to yet. Add a phone first.") : errText(r), r.ok && r.json.sent);
  });

  if (pass) start().catch(() => {});
})();
