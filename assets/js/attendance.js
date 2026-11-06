/* attendance.html — the hotel's staff attendance app. Talks to
   /api/attendance. Signing in swaps the password for a sign-in pass
   (api/attendance.js, action=login); only the pass is kept on the device:
   "Keep me signed in on this phone" keeps it in localStorage (it stays after
   the app is closed), otherwise sessionStorage (this tab only). Today
   refreshes itself every 30 seconds. */

(function () {
  "use strict";
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const KEY = "hpp-attendance";
  const MACHINE_HOST = "www.hotelperfectplaza.com";
  let pass = null;
  try { pass = localStorage.getItem(KEY) || sessionStorage.getItem(KEY); } catch (e) {}

  /* English or नेपाली, per device (the button at the top). In Nepali,
     attendance-ne.js translates the page and everything drawn after it. */
  const LANG_KEY = "hpp-attendance-lang";
  let lang = "en";
  try { if (localStorage.getItem(LANG_KEY) === "ne" && window.HPP_NE) lang = "ne"; } catch (e) {}
  const T = s => lang === "ne" ? window.HPP_NE.tr(s) : s;

  /* per device: bigger text, and how Today is shown (phones start on the simple list) */
  const SIZE_KEY = "hpp-attendance-size", VIEW_KEY = "hpp-attendance-view";
  const stored = k => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
  const keep2 = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const applySize = s => { document.documentElement.classList.toggle("size-l", s === "l"); document.documentElement.classList.toggle("size-xl", s === "xl"); };
  applySize(stored(SIZE_KEY));
  let view = stored(VIEW_KEY) || (matchMedia("(max-width: 900px)").matches ? "simple" : "timeline");
  const confirm = s => window.confirm(T(s));
  const prompt = (s, d) => window.prompt(T(s), d);

  /* ------------------------------------------------------------ helpers */
  const today = () => new Date(Date.now() + 345 * 60000).toISOString().slice(0, 10);   /* Nepal, UTC+5:45 */
  const addDays = (s, n) => new Date(Date.parse(s + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
  const monthEnd = m => addDays(addDays(m + "-01", 32).slice(0, 7) + "-01", -1);
  const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  /* Dates in the Nepali calendar (वि.सं., nepali-date.js) or the English one,
     per device: the वि.सं. / AD button. Dates are kept and sent as English
     (AD) dates throughout; only what is shown changes. Nepali-language
     phones start on Nepali dates. */
  const ND = window.NepaliDate || null;
  const CAL_KEY = "hpp-attendance-cal";
  let cal = lang === "ne" ? "bs" : "ad";
  try { cal = localStorage.getItem(CAL_KEY) || cal; } catch (e) {}
  if (!ND) cal = "ad";
  const bsOf = d => cal === "bs" ? ND.toBS(d) : null;          /* null outside the calendar's years: English */
  const bsText = d => { const b = ND && ND.toBS(d); return b ? `${b.d} ${ND.MONTHS[b.m - 1]} ${b.y}` : ""; };
  const wd = d => new Date(d + "T00:00:00Z").getUTCDay();
  const nice = d => { const b = bsOf(d); return b ? `${WD[wd(d)]}, ${b.d} ${ND.MONTHS[b.m - 1]}`
    : new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }); };
  const longDay = d => { const b = bsOf(d); return b ? `${DAYS[wd(d)]} ${b.d} ${ND.MONTHS[b.m - 1]} ${b.y}`
    : new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }); };
  const rs = n => "Rs " + Math.round(Number(n) || 0).toLocaleString("en-IN");
  const clock = s => { if (!s) return ""; const [h, m] = s.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
  const dur = min => { if (!min) return "—"; const h = Math.floor(min / 60), m = min % 60; return (h ? h + "h " : "") + (m || !h ? m + "m" : "").trim(); };
  const hours = min => (min / 60).toFixed(1);
  const msg = (el, text, ok) => { el.textContent = text || ""; el.className = "msg" + (el.classList.contains("wide") ? " wide" : "") + (text ? (ok ? " ok" : " bad") : ""); };
  const ERR = { pin: "Choose a staff member (or check the machine number).", time: "That date or time isn't right.", future: "That time hasn't happened yet.",
    exists: "There is already a punch at exactly that time.", shift: "Give both shift times, or leave both empty.", money: "Check the salary and overtime amounts.",
    dates: "Check the dates (at most 62 days at once).", telegram: "TELEGRAM_BOT_TOKEN isn't set in Vercel yet (ATTENDANCE.md, step 2).",
    notify: "Turn on notifications on a phone first (Settings → Notifications on this phone).",
    kind: "Choose what kind it is.",
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
  function fill(table, head, rows, { foot, rowProps, empty } = {}) {
    table.textContent = "";
    const th = h => Array.isArray(h) ? el("th", { className: h[1] }, h[0]) : el("th", {}, h);
    const td = c => c && typeof c === "object" && !(c instanceof Node) && !Array.isArray(c) ? el("td", { className: c.cls }, c.v) : el("td", {}, c);
    table.append(el("thead", {}, el("tr", {}, head.map(th))));
    const body = el("tbody");
    if (!rows.length) body.append(el("tr", {}, el("td", { colspan: head.length, className: "muted" }, empty || "Nothing here yet.")));
    rows.forEach((r, i) => body.append(el("tr", rowProps ? rowProps(i) : {}, r.map(td))));
    table.append(body);
    if (foot) table.append(el("tfoot", {}, el("tr", {}, foot.map(td))));
  }
  const btn = (text, onclick, cls = "btn btn--small btn--plain") => el("button", { type: "button", className: cls, onclick }, text);
  const DANGER = "btn btn--small btn--danger";

  /* the masthead's clock: Nepal time, whatever the phone's own time zone */
  function tickClock() {
    const d = new Date(Date.now() + 345 * 60000).toISOString();
    $("[data-clock]").textContent = longDay(d.slice(0, 10)) + ", " + clock(d.slice(11, 16));
  }
  tickClock(); setInterval(tickClock, 15000);

  async function api(action, { method = "GET", query = {}, body } = {}) {
    let res;
    try {
      res = await fetch("/api/attendance?" + new URLSearchParams({ action, ...query }), {
        method, headers: { Authorization: "Bearer " + pass, ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (e) {
      $("[data-offline]").hidden = false;
      msg($("[data-login-msg]"), "No internet. Connect and try again.");
      throw e;
    }
    $("[data-offline]").hidden = true;
    let json = {}; try { json = await res.json(); } catch (e) {}
    if (res.status === 401) { signOut(String(pass || "").startsWith("v1.") ? "Signed out: the password was changed. Sign in with the new one." : "Wrong password."); throw new Error("password"); }
    if (res.status === 429) { signOut(`Too many wrong passwords. Try again in ${json.minutes || 15} minutes.`); throw new Error("locked"); }
    if (res.status === 503 && json.error === "setup") { signOut("Attendance isn't set up yet: ATTENDANCE_PASSWORD or the database is missing in Vercel."); throw new Error("setup"); }
    return { ok: res.ok, status: res.status, json };
  }
  const post = (action, body) => api(action, { method: "POST", body });

  /* ------------------------------------------------------------ sign in */
  let timer = null;
  function signOut(text) {
    pass = null; try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); } catch (e) {}
    clearInterval(timer);
    $("[data-shell]").hidden = true; $("[data-signin]").hidden = false;
    $("#pw").value = "";
    msg($("[data-login-msg]"), text || "");
  }
  const keep = token => { try { (localStorage.getItem(KEY) || $("[data-remember]").checked ? localStorage : sessionStorage).setItem(KEY, token); } catch (e) {} };
  async function start() {
    $("[data-signin]").hidden = true; $("[data-shell]").hidden = false;
    /* a device still holding a password from before sign-in passes: swap it */
    if (!String(pass).startsWith("v1.")) { const r = await post("login"); if (r.ok) { pass = r.json.token; keep(pass); } }
    const t = today();
    $("[data-day-date]").value ||= t;
    const tb = bsOf(t);
    if (!$("[data-rep-from]").value) {
      if (tb) bsMonth(tb.y, tb.m);                                     /* this Nepali month */
      else { $("[data-rep-month]").value = t.slice(0, 7); $("[data-rep-from]").value = t.slice(0, 8) + "01"; $("[data-rep-to]").value = monthEnd(t.slice(0, 7)); }
    }
    $("[data-pun-from]").value ||= addDays(t, -6);
    $("[data-pun-to]").value ||= t;
    $("[data-lv-from]").value ||= t.slice(0, 8) + "01";
    $("[data-lv-to]").value ||= addDays(t, 90);
    $("[data-punch-form]").day.value ||= t;
    $("[data-leave-form]").from.value ||= t;
    hints();
    await loadStaff();
    show((location.hash.slice(1) || "day"));
    if (current !== "day") api("today").then(r => machinePill(r.json.machines)).catch(() => {});
    clearInterval(timer);
    timer = setInterval(() => { if (pass && current === "day" && $("[data-day-date]").value === today() && !document.hidden) loadDay().catch(() => {}); }, 30000);
  }
  $("[data-login]").addEventListener("submit", async e => {
    e.preventDefault();
    const button = $("[data-login] button[type=submit]");
    pass = $("#pw").value;
    button.disabled = true; msg($("[data-login-msg]"), "");
    try {
      const r = await post("login");
      if (r.ok) {
        pass = r.json.token;
        try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); ($("[data-remember]").checked ? localStorage : sessionStorage).setItem(KEY, pass); } catch (err) {}
        $("#pw").value = "";
        start();
      }
    } catch (err) { /* message already shown */ }
    finally { button.disabled = false; }
  });
  $$("[data-logout]").forEach(b => b.addEventListener("click", () => signOut("")));

  /* --------------------------------------------------------------- tabs */
  let current = "day";
  const loaders = { day: () => loadDay(), report: () => loadReport(), punches: () => loadPunches(), staff: () => Promise.all([loadStaff(), loadRoster()]), leave: () => loadLeave(), settings: () => loadSettings() };
  const TITLES = { day: "Daily attendance", report: "Monthly report", punches: "Punches", staff: "Staff", leave: "Leave and holidays", settings: "Settings" };
  function show(tab) {
    if (!loaders[tab]) tab = "day";
    current = tab;
    $("[data-page-title]").textContent = TITLES[tab];
    document.title = T(TITLES[tab] + " — Hotel Perfect Plaza");
    scrollTo(0, 0);
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
    fill($("[data-staff-table]"), [["No.", "num"], "Name", "Job", "Shift", "Day off", ["Salary", "num"], "SSF", "Messages", "", ["Punches", "num"], ""],
      staff.map(s => [
        { v: s.pin, cls: "num" },
        { v: s.name || el("span", { className: "warn" }, "No name yet"), cls: "name" },
        s.job, s.shift_start ? `${clock(s.shift_start)} – ${clock(s.shift_end)}` : el("span", { className: "muted" }, "usual hours"),
        s.weekly_off == null ? "—" : DAYS[s.weekly_off],
        { v: s.salary ? rs(s.salary) : "—", cls: "num" },
        s.ssf ? "Yes" : "—",
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
    f.notify.checked = s.notify; f.active.checked = s.active; f.ssf.checked = !!s.ssf;
    f.pin.readOnly = true;
    hints();
    $("[data-staff-form-title]").textContent = "Edit " + (s.name || "Staff #" + s.pin);
    msg($("[data-staff-msg]"), "");
    f.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  $("[data-staff-new]").addEventListener("click", () => {
    const f = $("[data-staff-form]");
    f.pin.readOnly = false;
    $("[data-staff-form-title]").textContent = "Add staff";
    setTimeout(() => { f.notify.checked = true; f.active.checked = true; hints(); });
  });
  $("[data-staff-form]").addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target, m = $("[data-staff-msg]");
    const isNew = !f.pin.readOnly && staff.some(s => s.pin === f.pin.value.trim());
    if (isNew) return msg(m, `Machine no. ${f.pin.value} is already in the list. Use its Edit button.`);
    const r = await post("staff", {
      pin: f.pin.value.trim(), name: f.name.value, job: f.job.value, phone: f.phone.value,
      shift_start: f.shift_start.value, shift_end: f.shift_end.value, weekly_off: f.weekly_off.value,
      salary: f.salary.value, ot_rate: f.ot_rate.value, joined: f.joined.value, notify: f.notify.checked, active: f.active.checked, ssf: f.ssf.checked
    });
    if (!r.ok) return msg(m, errText(r));
    msg(m, "Saved.", true);
    await loadStaff();
    const s = staff.find(x => x.pin === f.pin.value.trim());
    if (s) editStaff(s);
  });

  /* ------------------------------------------------------------- roster */
  /* A week (Sunday to Saturday) per person: their usual shift, a shift from
     Settings, or a day off. Each change is saved as it is made. */
  let rosWeek = null;
  const weekStart = d => addDays(d, -wd(d));
  const shiftLabel = s => `${s.name} ${clock(s.start)}–${clock(s.end)}`;
  async function loadRoster() {
    rosWeek ||= weekStart(today());
    const j = (await api("roster", { query: { from: rosWeek } })).json;
    const days = Array.from({ length: 7 }, (_, i) => addDays(rosWeek, i));
    $("[data-ros-week]").textContent = `${nice(days[0])} – ${nice(days[6])}`;
    const legend = $("[data-ros-legend]"); legend.textContent = "";
    j.shifts.forEach((x, i) => legend.append(el("span", { "data-k": String(i) }, el("b", {}, x.name), " ", `${clock(x.start)}–${clock(x.end)}`)));
    const t = $("[data-roster]"); t.textContent = "";
    t.append(el("thead", {}, el("tr", {}, el("th", { className: "who" }, "Staff"),
      days.map(d => { const b = bsOf(d); return el("th", { className: (wd(d) === 6 ? "sat" : "") + (d === today() ? " today" : "") }, WD[wd(d)], el("small", {}, b ? b.d : +d.slice(8))); }))));
    const body = el("tbody");
    if (!j.staff.length) body.append(el("tr", {}, el("td", { colspan: 8, className: "muted" }, "No staff yet.")));
    for (const s of j.staff) {
      const usual = s.shift_start ? `${clock(s.shift_start)}–${clock(s.shift_end)}` : `${clock(j.usual.start)}–${clock(j.usual.end)}`;
      const tr = el("tr", {}, el("td", { className: "who" }, s.name || "Staff #" + s.pin, el("small", {}, usual)));
      for (const d of days) {
        const e = j.entries.find(x => x.pin === s.pin && x.day === d);
        const weeklyOff = s.weekly_off != null && Number(s.weekly_off) === wd(d);
        const sel = el("select", { "aria-label": `${s.name || s.pin}, ${nice(d)}` },
          el("option", { value: "" }, weeklyOff ? "Usual: day off" : "Usual"),
          j.shifts.map((x, i) => el("option", { value: String(i) }, x.name)),
          el("option", { value: "off" }, "Day off"));
        let v = "";
        if (e && e.off) v = "off";
        else if (e) {
          const i = j.shifts.findIndex(x => x.name === e.name && x.start === e.start && x.end === e.end);
          if (i >= 0) v = String(i);
          else { sel.append(el("option", { value: "custom" }, shiftLabel(e))); v = "custom"; }
        }
        sel.value = v;
        const paint = () => { sel.dataset.k = sel.value === "" ? (weeklyOff ? "off" : "") : sel.value; };
        paint();
        sel.addEventListener("change", async () => {
          if (sel.value === "custom") return;
          const shift = sel.value === "" ? null : sel.value === "off" ? "off" : j.shifts[+sel.value];
          const r = await post("roster", { pin: s.pin, day: d, shift });
          msg($("[data-ros-msg]"), r.ok ? "Saved." : errText(r), r.ok);
          paint();
        });
        tr.append(el("td", {}, sel));
      }
      body.append(tr);
    }
    t.append(body);
  }
  $("[data-ros-prev]").addEventListener("click", () => { rosWeek = addDays(rosWeek, -7); loadRoster(); });
  $("[data-ros-next]").addEventListener("click", () => { rosWeek = addDays(rosWeek, 7); loadRoster(); });
  $("[data-ros-copy]").addEventListener("click", async () => {
    if (!confirm("Copy last week's roster into this week? This week's choices are replaced.")) return;
    const r = await post("roster-copy", { from: rosWeek });
    msg($("[data-ros-msg]"), r.ok ? "Copied." : errText(r), r.ok);
    loadRoster();
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
  const times = rec => rec.punches.map(p => clock(p.time) + (p.manual ? " (by hand)" : "")).join(", ");

  async function loadDay() {
    const d = $("[data-day-date]").value || today();
    const isToday = d === today();
    let rows;
    if (isToday) {
      const r = await api("today");
      rows = r.json.rows;
      nowStamp = r.json.now;
      setup(r.json);
      machinePill(r.json.machines);
    } else {
      const r = await api("report", { query: { from: d, to: d } });
      rows = r.json.staff.map(s => ({ pin: s.pin, name: s.displayName, job: s.job, rec: s.days[0] }));
      $("[data-setup]").hidden = true;
    }
    $("[data-day-title]").textContent = isToday ? "Today, " + longDay(d) : longDay(d);
    $("[data-day-today]").hidden = isToday;
    $("[data-day-next]").disabled = isToday;
    $("[data-board-note]").textContent = isToday ? "Updates by itself every 30 seconds" : "";
    const hour = new Date(Date.now() + 345 * 60000).getUTCHours();
    $("[data-greeting]").textContent = hour >= 4 && hour < 12 ? "Good morning" : hour >= 12 && hour < 17 ? "Good afternoon" : "Good evening";
    lede(rows, isToday);
    lastBoard = [rows, isToday ? ms(nowStamp) : null, isToday];
    simple(rows, isToday);
    applyView();
    if (view === "timeline") board(...lastBoard);
  }

  /* Simple or Timeline */
  function applyView() {
    $$("[data-view]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.view === view)));
    $("[data-simple]").hidden = view !== "simple";
    $("[data-timeline]").hidden = $("[data-key]").hidden = view !== "timeline";
    const pref = $("[data-view-pref]"); if (pref) pref.value = view;
  }
  function setView(v) { view = v; keep2(VIEW_KEY, v); applyView(); if (v === "timeline" && lastBoard) board(...lastBoard); }
  $$("[data-view]").forEach(b => b.addEventListener("click", () => setView(b.dataset.view)));

  /* a person's initials in a coloured circle */
  function avatar(name, pin, big) {
    const words = String(name).replace(/^Staff #/, "#").split(/\s+/).filter(Boolean);
    const letters = (words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] || "?").slice(0, 2)).toUpperCase();
    let h = 0; for (const c of String(pin)) h = (h * 31 + c.charCodeAt(0)) % 997;
    return el("span", { className: "avatar" + (big ? " avatar--big" : ""), "data-c": String(h % 6), "aria-hidden": "true" }, letters);
  }
  const telOf = p => String(p || "").replace(/[^\d+]/g, "");

  /* The day as groups of people: not come, not due yet, in the hotel, gone
     home, away. Each person opens their card; each has a call button. */
  function simple(rows, isToday) {
    const box = $("[data-simple]"); box.textContent = "";
    if (!rows.length) { box.append(el("p", { className: "card board__empty" }, "No staff yet. Add them in Staff, or they appear here after their first punch.")); return; }
    const away = x => ["leave", "off", "holiday", "none"].includes(x.status);
    const groups = isToday ? [
      ["absent", "Not come yet", x => x.status === "absent"],
      ["inside", "In the hotel now", x => x.inside],
      ["upcoming", "Not due yet", x => x.status === "upcoming" && !x.punches.length && !x.leave && !x.off && !x.holiday],
      ["gone", "Gone home", x => x.punches.length && !x.inside],
      ["away", "On leave or day off", x => !x.punches.length && (away(x) || (x.status === "upcoming" && (x.leave || x.off || x.holiday)))]
    ] : [
      ["absent", "Absent", x => x.status === "absent"],
      ["gone", "Came", x => x.punches.length],
      ["away", "On leave or day off", x => !x.punches.length && x.status !== "absent"]
    ];
    for (const [key, title, test] of groups) {
      const list = rows.filter(r => test(r.rec));
      if (!list.length) continue;
      const sec = el("section", { className: "group group--" + key, "data-group": key },
        el("h3", {}, el("span", {}, title), " ", el("b", {}, String(list.length))));
      for (const r of list) {
        const tel = telOf(r.phone);
        sec.append(el("div", { className: "pcard" },
          el("button", { type: "button", className: "pcard__open", onclick: () => openSheet(r) },
            avatar(r.name, r.pin),
            el("span", { className: "pcard__who" }, el("b", {}, r.name), r.job ? el("small", {}, r.job) : null, el("span", { className: "chips" }, chips(r.rec, isToday))),
            el("span", { className: "pcard__facts" }, facts(r.rec, isToday))),
          tel ? el("a", { className: "callbtn", href: "tel:" + tel, "aria-label": `Call ${r.name}` }, "📞", el("span", {}, "Call")) : null));
      }
      box.append(sec);
    }
  }
  const jump = key => { setView("simple"); const g = $(`[data-group="${key}"]`); if (g) g.scrollIntoView({ behavior: "smooth", block: "start" }); };

  /* --------------------------------------------------------- person card */
  let sheetRow = null;
  async function openSheet(r) {
    sheetRow = r;
    const dlg = $("[data-sheet]");
    const av = avatar(r.name, r.pin, true); av.setAttribute("data-sheet-avatar", "");
    $("[data-sheet-avatar]").replaceWith(av);
    $("[data-sheet-name]").textContent = r.name;
    $("[data-sheet-job]").textContent = [r.job, r.phone].filter(Boolean).join(" · ");
    const call = $("[data-sheet-call]"), tel = telOf(r.phone);
    call.hidden = !tel; call.href = tel ? "tel:" + tel : "#"; call.textContent = `📞 Call ${r.name}`;
    const td = $("[data-sheet-today]"); td.textContent = "";
    td.append(el("div", { className: "chips" }, chips(r.rec, r.rec.day === today())), el("p", { className: "srow__facts" }, facts(r.rec, r.rec.day === today())));
    msg($("[data-sheet-msg]"), "");
    $("[data-sheet-stats]").textContent = ""; $("[data-sheet-marks]").textContent = "";
    if (!dlg.open) dlg.showModal();
    /* this month so far: the Nepali month with Nepali dates on */
    const t = today(), b = bsOf(t), from = b ? ND.toAD(b.y, b.m, 1) : t.slice(0, 8) + "01";
    $("[data-sheet-month]").textContent = "This month: " + (b ? `${ND.MONTHS[b.m - 1]} ${b.y}` : new Date(t + "T00:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }));
    const rep = (await api("report", { query: { from, to: t } })).json;
    const s = rep.staff.find(x => x.pin === r.pin);
    if (!s || sheetRow !== r) return;
    const x = s.summary, stat = (k, v, cls) => el("div", { className: cls || "" }, el("b", {}, String(v)), el("span", {}, k));
    $("[data-sheet-stats]").append(stat("Present", x.present), stat("Absent", x.absent, x.absent ? "bad" : ""), stat("Late", x.late, x.late ? "warn" : ""),
      stat("Leave", x.paidLeave + x.unpaidLeave), stat("Overtime (h)", hours(x.ot)), s.salary ? stat("Pay so far", rs(x.pay), "good") : null);
    $("[data-sheet-marks]").append(...s.days.map(d => el("span", { className: "sheet__mark" }, mark(d), el("small", {}, String((bsOf(d.day) || { d: +d.day.slice(8) }).d)))));
  }
  $("[data-sheet-close]").addEventListener("click", () => $("[data-sheet]").close());
  $("[data-sheet]").addEventListener("click", e => { if (e.target === e.currentTarget) e.currentTarget.close(); });   /* tap outside */
  $("[data-sheet-leave]").addEventListener("submit", async e => {
    e.preventDefault();
    const r = await post("leave", { pin: sheetRow.pin, from: today(), to: today(), kind: e.target.kind.value });
    msg($("[data-sheet-msg]"), r.ok ? "Saved." : errText(r), r.ok);
    if (r.ok) loadDay();
  });
  $("[data-sheet-punch]").addEventListener("submit", async e => {
    e.preventDefault();
    const r = await post("punch", { pin: sheetRow.pin, day: today(), time: e.target.time.value, note: "added from the person card" });
    msg($("[data-sheet-msg]"), r.ok ? "Added." : errText(r), r.ok);
    if (r.ok) { e.target.time.value = ""; loadDay(); }
  });
  $("[data-sheet-slip]").addEventListener("click", () => { slipPin = sheetRow.pin; $("[data-sheet]").close(); show("report"); });

  /* ---------------------------------------------------- share the day */
  let shareText = "";
  $("[data-share]").addEventListener("click", async () => {
    const text = shareText + "\n— " + T("Hotel Perfect Plaza");
    try {
      if (navigator.share) await navigator.share({ title: T("Daily attendance"), text });
      else { await navigator.clipboard.writeText(text); alert(T("Copied. Paste it into WhatsApp or Viber.")); }
    } catch (e) { /* closed without sharing */ }
  });
  let lastBoard = null, resizing = 0;
  addEventListener("resize", () => { clearTimeout(resizing); resizing = setTimeout(() => { if (lastBoard && current === "day") board(...lastBoard); }, 150); });
  const go = n => { $("[data-day-date]").value = addDays($("[data-day-date]").value || today(), n); loadDay(); };
  $("[data-day-date]").addEventListener("change", () => loadDay());
  $("[data-day-prev]").addEventListener("click", () => go(-1));
  $("[data-day-next]").addEventListener("click", () => go(1));
  $("[data-day-today]").addEventListener("click", () => { $("[data-day-date]").value = today(); loadDay(); });

  const ms = s => Date.parse(s.slice(0, 19).replace(" ", "T") + "Z");      /* Nepal wall time → ms */
  const at = (day, hm) => Date.parse(`${day}T${hm}:00Z`);
  const HOUR = 3600000;
  const hourLabel = t => { const h = new Date(t).getUTCHours(); return h === 0 ? "midnight" : h === 12 ? "noon" : `${h % 12} ${h < 12 ? "am" : "pm"}`; };
  let nowStamp = "";

  /* The day's numbers, each with the names behind it. */
  function lede(rows, isToday) {
    const box = $("[data-day-lede]"); box.textContent = "";
    const pick = f => rows.filter(r => f(r.rec));
    const came = pick(x => x.punches.length), late = pick(x => x.late), away = pick(x => x.status === "absent");
    const inside = pick(x => x.inside), leave = pick(x => x.status === "leave");
    const ot = rows.reduce((a, r) => a + r.rec.ot, 0);
    const names = list => list.map(r => r.name).join(", ");
    const GROUP = { ok: "gone", in: "inside", late: "inside", absent: "absent", ot: "gone" };
    const stat = (cls, label, num, sub) => box.append(el("button", { type: "button", className: "stat stat--" + cls, onclick: () => jump(GROUP[cls]) },
      el("span", { className: "stat__label" }, label), el("span", { className: "stat__num" }, num), el("span", { className: "stat__sub" }, sub || "")));
    /* the same, as text to share */
    const line = (label, value) => value ? `\n${T(label)}: ${T(value)}` : "";
    shareText = T($("[data-day-title]").textContent) + line(isToday ? "Came today" : "Came", `${came.length} / ${rows.length}`) +
      line("In the hotel now", isToday ? names(inside) : "") + line("Late", late.map(r => `${r.name} ${dur(r.rec.late)}`).join(", ")) +
      line(isToday ? "Not come" : "Absent", names(away)) + line("On leave", names(leave)) + line("Overtime", ot ? dur(ot) : "");
    stat("ok", isToday ? "Came today" : "Came", [String(came.length), el("small", {}, " / " + rows.length)], rows.length ? (came.length === rows.length ? "Everyone" : "") : "No staff yet");
    if (isToday) stat("in", "In the hotel now", String(inside.length), names(inside));
    stat("late", "Late", String(late.length), late.map(r => `${r.name} ${dur(r.rec.late)}`).join(", "));
    stat("absent", isToday ? "Not come" : "Absent", String(away.length), names(away) + (leave.length ? (away.length ? "; " : "") + `${leave.length} on leave` : ""));
    stat("ot", "Overtime", ot ? dur(ot) : "—", names(pick(x => x.ot > 0)));
  }

  /* The day as a strip per person: the shift (dashed), time at work (green),
     a late start (marigold), overtime (blue), each punch (a tick), now (red). */
  function board(rows, nowT, isToday) {
    const box = $("[data-board]"); box.textContent = "";
    if (!rows.length) { box.append(el("p", { className: "board__empty" }, "No staff yet. Add them in Staff, or they appear here after their first punch.")); return; }
    const info = rows.map(r => {
      const x = r.rec, s = at(x.day, x.shiftStart);
      return { s, e: s + x.shiftLen * 60000, scheduled: !x.off && !x.holiday, ps: x.punches.map(p => ({ t: ms(p.at), manual: p.manual, time: p.time })) };
    });
    let lo = Infinity, hi = -Infinity;
    const take = t => { lo = Math.min(lo, t); hi = Math.max(hi, t); };
    info.forEach(sp => { if (sp.scheduled) { take(sp.s); take(sp.e); } sp.ps.forEach(p => take(p.t)); });
    if (nowT) take(nowT);
    if (!isFinite(lo)) { lo = at(rows[0].rec.day, "07:00"); hi = lo + 14 * HOUR; }
    lo = Math.floor(lo / HOUR) * HOUR - HOUR; hi = Math.ceil(hi / HOUR) * HOUR + HOUR;
    const span = hi - lo, pct = t => ((t - lo) / span * 100).toFixed(3) + "%";
    const place = (parent, cls, a, b, title) => {
      const n = el("i", { className: cls, title });
      n.style.left = pct(a);
      if (b != null) n.style.width = ((b - a) / span * 100).toFixed(3) + "%";
      parent.append(n); return n;
    };

    /* hour labels at least ~60px apart, at whatever width the strips have */
    const stripPx = box.clientWidth - (matchMedia("(max-width: 900px)").matches ? 32 : 490);
    const gap = lang === "ne" ? 72 : 60, edge = gap / 2 / stripPx * span;   /* Nepali labels are longer */
    const step = ([1, 2, 3, 4, 6, 12].find(h => h * HOUR / span * stripPx >= gap) || 12) * HOUR;
    const ticks = el("div", { className: "ticks", "aria-hidden": "true" });
    for (let t = Math.ceil((lo + edge) / step) * step; t < hi - edge; t += step) {
      const n = el("span", { className: "tick" + (new Date(t).getUTCHours() === 0 ? " mid" : "") }, hourLabel(t));
      n.style.left = pct(t); ticks.append(n);
    }
    if (nowT) { const n = el("span", { className: "tick nowlabel" }, clock(new Date(nowT).toISOString().slice(11, 16))); n.style.left = pct(nowT); ticks.append(n); }
    box.append(el("div", { className: "board__axis" }, el("div"), ticks, el("div")));

    rows.forEach((r, i) => {
      const x = r.rec, sp = info[i], P = sp.ps;
      const strip = el("div", { className: "strip", role: "img", "aria-label": describe(r, isToday) });
      strip.style.setProperty("--hour", (HOUR / span * 100) + "%");
      strip.style.backgroundPosition = "0 0";
      if (sp.scheduled) place(strip, "s-shift", sp.s, sp.e, `Shift ${clock(x.shiftStart)} to ${clock(x.shiftEnd)}`);
      if (x.late && P.length) place(strip, "s-late", sp.s, P[0].t, `${dur(x.late)} late`);
      const bar = (a, b, cls) => {
        place(strip, "s-bar " + cls, a, b);
        const from = sp.scheduled ? Math.max(a, sp.e) : a;
        if (x.ot && b > from) place(strip, "s-bar ot", from, b, "Overtime").style.borderRadius = from > a ? "0 99px 99px 0" : "";
      };
      for (let k = 0; k + 1 < P.length; k += 2) bar(P[k].t, P[k + 1].t, "");
      if (P.length % 2) {
        const last = P[P.length - 1].t;
        if (x.inside && nowT) { bar(last, nowT, "open"); place(strip, "s-dot", nowT, null, "Still at work"); }
        else place(strip, "s-bar lost", last, last + HOUR, "No punch out");
      }
      P.forEach(p => place(strip, "s-punch" + (p.manual ? " hand" : ""), p.t, null, clock(p.time) + (p.manual ? ", added by hand" : "")));
      if (nowT) place(strip, "s-now", nowT, null);

      box.append(el("div", { className: "srow" + (x.status === "absent" ? " absent" : "") },
        el("div", { className: "srow__who" }, el("b", {}, r.name), r.job ? el("small", {}, r.job) : null, el("div", { className: "chips" }, chips(x, isToday))),
        strip,
        el("div", { className: "srow__facts" }, facts(x, isToday))));
    });
  }

  function facts(x, isToday) {
    if (!x.punches.length) {
      const say = {
        absent: [isToday ? "Not come yet" : "Absent", "bad"], leave: [LEAVE[x.leave] || "On leave"], holiday: [x.holiday], off: ["Day off"],
        none: ["Not joined yet"], upcoming: [isToday ? "" : "—"]
      }[x.status] || ["—"];
      const scheduled = !x.off && !x.holiday && !x.leave && x.status !== "none";
      return [el("span", { className: "times" }, scheduled ? `Shift ${clock(x.shiftStart)}` : "—"), el("span", { className: say[1] }, say[0])];
    }
    const parts = [el("span", {}, x.worked ? dur(x.worked) + " worked" : x.inside ? "just arrived" : "no time worked")];
    if (x.late) parts.push(el("span", { className: "late" }, dur(x.late) + " late"));
    if (x.early) parts.push(el("span", { className: "late" }, "left " + dur(x.early) + " early"));
    if (x.ot) parts.push(el("span", { className: "ot" }, "+" + dur(x.ot) + " overtime"));
    if (x.missing) parts.push(el("span", { className: "bad" }, "no punch out"));
    const out = [el("span", { className: "times" }, `${clock(x.in)} – ${x.inside ? "now" : x.out ? clock(x.out) : "?"}`)];
    parts.forEach((p, i) => out.push(i ? ", " : "", p));
    return out;
  }

  function describe(r, isToday) {
    const x = r.rec, f = facts(x, isToday).map(n => typeof n === "string" ? n : n.textContent).join(" ");
    return `${r.name}: ${f}. Punches: ${times(x) || "none"}.`;
  }

  function setup(t) {
    const items = [];
    const go = (text, tab) => items.push(el("li", {}, text, " ", el("button", { type: "button", className: "link", onclick: () => show(tab) }, "Open")));
    const approved = t.machines.filter(m => m.approved), waiting = t.machines.filter(m => !m.approved);
    if (!t.machines.length) go("No fingerprint machine has connected yet. See \"How to connect the machine\".", "settings");
    waiting.forEach(m => go(`A fingerprint machine (${m.sn}) is waiting for you to approve it.`, "settings"));
    if (!t.phones) go(t.notify ? "No phone gets a notification when someone punches yet. Settings → Turn on notifications, on your father's phone." : "Notifications aren't set up on the website yet.", "settings");
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

  /* a Nepali month: its first and last day as the report's From and To */
  function bsMonth(y, m) {
    const ys = $("[data-rep-bs-year]"), ms = $("[data-rep-bs-month]");
    if (!ys.options.length) {
      const [first, last] = ND.years(), now = ND.toBS(today());
      for (let k = Math.min(last, (now ? now.y : last) + 1); k >= Math.max(first, 2080); k--) ys.append(el("option", { value: String(k) }, String(k)));
      ND.MONTHS.forEach((n, i) => ms.append(el("option", { value: String(i + 1) }, n)));
    }
    ys.value = String(y); ms.value = String(m);
    $("[data-rep-from]").value = ND.toAD(y, m, 1);
    $("[data-rep-to]").value = ND.toAD(y, m, ND.daysIn(y, m));
    $("[data-rep-month]").value = "";
  }
  ["[data-rep-bs-year]", "[data-rep-bs-month]"].forEach(s => $(s).addEventListener("change", () => {
    bsMonth(+$("[data-rep-bs-year]").value, +$("[data-rep-bs-month]").value);
    loadReport();
  }));

  /* under each date box in a form, the Nepali date it is */
  function hints() {
    $$(".form input[type=date]").forEach(i => {
      let h = i.nextElementSibling;
      if (!h || !h.classList.contains("bshint")) { h = el("small", { className: "bshint" }); i.after(h); }
      const b = cal === "bs" && i.value ? ND.toBS(i.value) : null;
      h.textContent = b ? `वि.सं. ${b.d} ${ND.MONTHS[b.m - 1]} ${b.y}` : "";
      h.hidden = !b;
    });
  }
  ["input", "change"].forEach(ev => document.addEventListener(ev, e => { if (e.target.matches && e.target.matches(".form input[type=date]")) hints(); }));

  async function loadReport() {
    const r = await api("report", { query: { from: $("[data-rep-from]").value, to: $("[data-rep-to]").value } });
    report = r.json;
    const span = Math.round((Date.parse(report.to) - Date.parse(report.from)) / 86400000) + 1;
    const wholeMonth = span >= 28;
    const all = k => report.staff.reduce((a, s) => a + s.summary[k], 0);
    $("[data-rep-note]").textContent = `${nice(report.from)} to ${nice(report.to)}, ${span} days. ` +
      (report.staff.length ? `${all("late")} late arrival${all("late") === 1 ? "" : "s"}, ${all("absent")} day${all("absent") === 1 ? "" : "s"} absent, ${hours(all("ot"))} hours of overtime so far.` : "") +
      (wholeMonth ? "" : " Pay is only worked out for a whole month.");
    register(report.staff);
    const head = ["Staff", ["Present", "num"], ["Half day", "num"], ["Absent", "num"], ["Paid leave", "num"], ["Unpaid leave", "num"], ["Off & holidays", "num"],
      ["Late (times)", "num"], ["Late (total)", "num"], ["Hours worked", "num"], ["Overtime (h)", "num"], ["Overtime pay", "num"], ["Unpaid days", "num"], ["Salary", "num"]];
    if (wholeMonth) head.push(["Added", "num"], ["Taken off", "num"], ["Pay", "num"], "");
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
      if (wholeMonth) row.push(n(x.bonus + x.allowance ? rs(x.bonus + x.allowance) : "—"), n(x.takenOff ? rs(x.takenOff) : "—"),
        n(s.salary || x.gross ? rs(x.pay) : "—", "pay"),
        btn("Payslip", e => { e.stopPropagation(); openSlip(s.pin); }));
      return row;
    });
    const foot = ["Total", n(tot("present")), "", n(tot("absent")), "", "", "", n(tot("late")), "", n(hours(tot("worked"))), n(hours(tot("ot"))), n(rs(tot("otPay"))), "", n(rs(S.reduce((a, s) => a + (s.salary || 0), 0)))];
    if (wholeMonth) foot.push(n(rs(tot("bonus") + tot("allowance"))), n(rs(tot("takenOff"))), n(rs(tot("pay"))), "");
    fill($("[data-rep-table]"), head, rows, { foot: S.length ? foot : null, rowProps: i => ({ className: "click", title: "See every day", onclick: () => detail(S[i]) }) });
    $("[data-rep-detail]").hidden = true;
    $("[data-slips-print]").hidden = !wholeMonth || !S.length;
    if (slipPin && wholeMonth && S.some(s => s.pin === slipPin)) openSlip(slipPin, false); else closeSlip();
  }

  /* ----------------------------------------------------------- payslips */
  let slipPin = null;
  const amt = v => v ? Math.round(v).toLocaleString("en-IN") : "—";
  const KIND = { advance: "Salary advance", bonus: "Bonus", allowance: "Allowance", tax: "Tax", deduction: "Other deduction" };

  /* the month's name: a whole Nepali month, a whole English month, or the dates */
  function periodName() {
    const f = report.from, t = report.to, bf = ND && ND.toBS(f), bt = ND && ND.toBS(t);
    if (cal === "bs" && bf && bt && bf.d === 1 && bt.y === bf.y && bt.m === bf.m && bt.d === ND.daysIn(bt.y, bt.m)) return `${ND.MONTHS[bf.m - 1]} ${bf.y}`;
    if (f.slice(8) === "01" && t === monthEnd(f.slice(0, 7))) return new Date(f + "T00:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
    return `${nice(f)} – ${nice(t)}`;
  }

  /* one payslip, ready to show or print */
  function slipDoc(s) {
    const x = s.summary, emp = report.ssf.employee, hotel = report.ssf.employer;
    const pair = (k, v) => el("div", {}, el("dt", {}, k), el("dd", {}, v));
    const stat = (k, v) => el("div", {}, el("span", {}, k), el("b", {}, String(v)));
    const line = (label, small, v) => el("tr", {}, el("td", {}, el("span", {}, label), small ? el("small", {}, small) : null), el("td", { className: "num" }, v));
    const table = (title, rows, totalLabel, total) => el("table", {},
      el("thead", {}, el("tr", {}, el("th", {}, title), el("th", { className: "num" }, "Rs"))), el("tbody", {}, rows),
      el("tfoot", {}, el("tr", {}, el("td", {}, totalLabel), el("td", { className: "num" }, amt(total)))));
    return el("article", { className: "slip" },
      el("header", { className: "slip__head" },
        el("img", { src: "assets/images/hotel-logo.png", alt: "Hotel Perfect Plaza", className: "slip__logo" }),
        el("div", { className: "slip__title" }, el("b", {}, "Payslip"), el("span", {}, periodName()), el("small", {}, `${nice(report.from)} – ${nice(report.to)}`))),
      el("p", { className: "slip__addr" }, el("span", {}, "Ramanand Chowk, Janakpurdham"), " · +977-41-590911"),
      el("dl", { className: "slip__who" }, pair("Name", s.displayName), pair("Job", s.job || "—"), pair("Machine no.", s.pin), pair("Monthly salary", rs(s.salary))),
      el("div", { className: "slip__days" }, stat("Days", x.days), stat("Present", x.present), stat("Half days", x.half), stat("Absent", x.absent),
        stat("Paid leave", x.paidLeave), stat("Unpaid leave", x.unpaidLeave), stat("Days off & holidays", x.off + x.holiday), stat("Late", x.late), stat("Overtime (h)", hours(x.ot))),
      el("div", { className: "slip__cols" },
        table("Earnings", [
          line("Basic salary", x.unpaidDays ? `${x.unpaidDays} unpaid days × Rs ${x.dayRate} taken off` : null, amt(x.basicEarned)),
          line("Overtime", x.ot ? `${hours(x.ot)} hours × Rs ${x.otHourly}` : null, amt(x.otPay)),
          line("Bonus", null, amt(x.bonus)), line("Allowance", null, amt(x.allowance))], "Total earnings", x.gross),
        table("Deductions", [
          line("SSF", s.ssf ? `${emp}% of basic salary` : null, amt(x.ssf)),
          line("Salary advance", null, amt(x.advance)), line("Tax", null, amt(x.tax)), line("Other deductions", null, amt(x.otherDeduction))], "Total deductions", x.takenOff)),
      el("p", { className: "slip__net" }, el("span", {}, "Net pay"), el("b", {}, rs(x.pay))),
      s.ssf ? el("p", { className: "slip__note" }, el("span", {}, "SSF paid by the hotel, on top of this pay"), " ", el("b", {}, `${rs(x.ssfEmployer)} (${hotel}%)`)) : null,
      el("div", { className: "slip__sign" }, el("span", {}, "Received by"), el("span", {}, "For Hotel Perfect Plaza")));
  }

  function openSlip(pin, scroll = true) {
    const s = report.staff.find(x => x.pin === pin);
    if (!s) return;
    slipPin = pin;
    $("[data-slip-title]").textContent = `Payslip: ${s.displayName}`;
    const doc = $("[data-slip-doc]"); doc.textContent = ""; doc.append(slipDoc(s));
    fill($("[data-slip-adj]"), ["Date", "Kind", ["Amount", "num"], "Note", ""], s.summary.adjustments.map(a => [
      nice(a.day), KIND[a.kind], { v: rs(a.amount), cls: "num" }, a.note,
      btn("Remove", async () => { if (confirm("Remove this entry?")) { await post("adjust-delete", { id: a.id }); loadReport(); } }, DANGER)
    ]), { empty: "Nothing this month." });
    const f = $("[data-adj-form]"), t = today();
    if (!f.day.value || f.day.value < report.from || f.day.value > report.to) f.day.value = t >= report.from && t <= report.to ? t : report.to;
    hints();
    $("[data-slip]").hidden = false;
    if (scroll) $("[data-slip]").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function closeSlip() { slipPin = null; $("[data-slip]").hidden = true; }
  $("[data-slip-close]").addEventListener("click", closeSlip);

  $("[data-adj-form]").addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target, m = $("[data-adj-msg]");
    const r = await post("adjust", { pin: slipPin, day: f.day.value, kind: f.kind.value, amount: f.amount.value, note: f.note.value });
    if (!r.ok) return msg(m, errText(r));
    msg(m, "Added.", true);
    f.amount.value = ""; f.note.value = "";
    loadReport();
  });

  /* printing: just the payslip(s), one to a page */
  async function printSlips(list) {
    const area = $("[data-printarea]"); area.textContent = "";
    list.forEach(s => area.append(slipDoc(s)));
    area.hidden = false;
    document.body.classList.add("printing");
    await new Promise(r => setTimeout(r, 120));                       /* let the Nepali translation and the logo catch up */
    window.print();
  }
  addEventListener("afterprint", () => { document.body.classList.remove("printing"); $("[data-printarea]").hidden = true; });
  $("[data-slip-print]").addEventListener("click", () => { const s = report.staff.find(x => x.pin === slipPin); if (s) printSlips([s]); });
  $("[data-slips-print]").addEventListener("click", () => printSlips(report.staff.filter(s => s.salary || s.summary.gross)));

  /* The paper register: a row per person, a mark per day. */
  function mark(d) {
    const plan = d.holiday ? ["H", "hol"] : d.leave ? ["Lv", "v"] : d.off ? ["–", "o"] : null;
    let m;
    if (d.punches.length) m = d.status === "late" ? ["L", "l"] : d.status === "half" ? ["½", "h"] : ["P", "p"];
    else m = { absent: ["A", "a"], leave: ["Lv", "v"], holiday: ["H", "hol"], off: ["–", "o"], none: ["", "n"] }[d.status] || (plan ? [plan[0], "u"] : ["", "u"]);
    const said = d.punches.length
      ? `${clock(d.in)} to ${d.inside ? "now" : d.out ? clock(d.out) : "no punch out"}, ${dur(d.worked)} worked` + (d.late ? `, ${dur(d.late)} late` : "") + (d.ot ? `, ${dur(d.ot)} overtime` : "")
      : d.status === "leave" ? LEAVE[d.leave] : d.status === "holiday" ? d.holiday : d.status === "upcoming" ? (plan ? "planned: " + (d.holiday || LEAVE[d.leave] || "day off") : "still to come") : STATUS[d.status];
    return el("b", { className: `r r--${m[1]}` + (d.ot ? " ot" : "") + (d.manual ? " hand" : ""), title: `${nice(d.day)}: ${said}` }, m[0]);
  }
  function register(S) {
    const t = $("[data-rep-register]"); t.textContent = "";
    if (!S.length) { t.append(el("tbody", {}, el("tr", {}, el("td", { className: "who" }, "No staff yet.")))); return; }
    const days = S[0].days.map(d => d.day);
    t.append(el("thead", {}, el("tr", {}, el("th", { className: "who" }, ""),
      days.map(d => { const w = wd(d), b = bsOf(d); return el("th", { className: (w === 6 ? "sat" : "") + (d === today() ? " today" : ""), title: d === today() ? "Today" : null }, b ? b.d : +d.slice(8), el("small", {}, WD[w].slice(0, 2))); }),
      el("th", {}, ""))));
    t.append(el("tbody", {}, S.map(s => {
      const x = s.summary;
      return el("tr", {},
        el("td", { className: "who", onclick: () => detail(s), title: "See every day" }, s.displayName, s.job ? el("small", {}, s.job) : null),
        s.days.map(d => el("td", {}, mark(d))),
        el("td", { className: "sum" }, el("b", {}, x.present + x.half / 2), " present", x.absent ? `, ${x.absent} absent` : ""));
    })));
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
    const lines = [[`Hotel Perfect Plaza staff attendance ${report.from} to ${report.to}` + (ND && ND.toBS(report.from) ? ` (BS ${bsText(report.from)} to ${bsText(report.to)})` : "")], [],
      ["No.", "Name", "Job", "Present", "Half days", "Absent", "Paid leave", "Unpaid leave", "Days off", "Holidays", "Late (times)", "Late (minutes)",
       "Hours worked", "Overtime (hours)", "Overtime pay", "Unpaid days", "Deduction", "Salary", "Pay"]];
    report.staff.forEach(s => { const x = s.summary; lines.push([s.pin, s.displayName, s.job, x.present, x.half, x.absent, x.paidLeave, x.unpaidLeave, x.off, x.holiday,
      x.late, x.lateMin, hours(x.worked), hours(x.ot), x.otPay, x.unpaidDays, x.deduction, s.salary, x.pay]); });
    lines.push([], ["Every day"], ["No.", "Name", "Date", "Date (BS)", "Day", "Status", "In", "Out", "Worked (min)", "Late (min)", "Left early (min)", "Overtime (min)", "Punches", "Added by hand"]);
    report.staff.forEach(s => s.days.forEach(x => lines.push([s.pin, s.displayName, x.day, bsText(x.day), WD[wd(x.day)],
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
       p.source === "manual" ? btn("Delete", async () => { if (confirm("Delete this punch added by hand?")) { await post("punch-delete", { id: p.id }); loadPunches(); } }, DANGER) : null]
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
    f.reset(); hints(); loadLeave();
  });

  /* ----------------------------------------------------------- settings */
  async function loadSettings() {
    const r = await api("settings");
    const j = r.json, f = $("[data-set-form]");
    for (const [k, v] of Object.entries(j.settings)) {
      if (!f[k]) continue;
      if (f[k].type === "checkbox") f[k].checked = v === "1"; else f[k].value = v;
    }
    let shifts = []; try { shifts = JSON.parse(j.settings.shifts); } catch (e) {}
    $("[data-shifts]").textContent = "";
    shifts.forEach(addShiftRow);
    const tg = $("[data-tg-status]"); tg.textContent = "";
    tg.append(j.telegram.ready
      ? el("p", {}, "Bot: ", el("strong", {}, j.telegram.bot ? "@" + j.telegram.bot : "(couldn't reach Telegram)"), ". Every phone below gets a message the moment someone punches.")
      : el("p", { className: "hint" }, "Not in use. To use it: create a bot with @BotFather in Telegram and add its token in Vercel as TELEGRAM_BOT_TOKEN (ATTENDANCE.md)."));
    $("[data-tg-link]").hidden = $("[data-tg-test]").hidden = !j.telegram.ready;
    $(".tgcard").open = j.telegram.ready && j.chats.length > 0;
    fill($("[data-chat-table]"), ["Phone (Telegram name)", "Added", "", ""], j.chats.map(c => [
      { v: c.name, cls: "name" }, nice(c.added), c.active ? el("span", { className: "chip present" }, "Gets messages") : el("span", { className: "chip off" }, "Paused"),
      [btn(c.active ? "Pause" : "Resume", async () => { await post("chat", { chat_id: c.chat_id, active: !c.active }); loadSettings(); }),
       btn("Remove", async () => { if (confirm(`Stop sending messages to ${c.name}?`)) { await post("chat", { chat_id: c.chat_id, remove: true }); loadSettings(); } }, DANGER)]
    ]));
    $("[data-dev-host]").textContent = MACHINE_HOST;
    backupYears();
    fill($("[data-dev-table]"), ["Machine (serial no.)", "Status", "Last connected", "Clock", ""], j.machines.map(m => [
      { v: [m.name || m.sn, m.name ? el("small", {}, m.sn) : null], cls: "name" },
      m.approved ? (m.ago > 3600 ? el("span", { className: "chip absent" }, "Offline") : el("span", { className: "chip present" }, "Online"))
        : el("span", { className: "chip late" }, "Waiting for approval"),
      `${nice(m.last_seen.slice(0, 10))}, ${clock(m.last_seen.slice(11))}`,
      m.clock_fast ? el("span", { className: "bad" }, `${m.clock_fast} min fast`) : "OK",
      [m.approved ? btn("Stop", async () => { if (confirm("Stop taking punches from this machine?")) { await post("device", { sn: m.sn, approved: false }); loadSettings(); } })
                  : btn("Approve", async () => { await post("device", { sn: m.sn, approved: true }); loadSettings(); }, "btn btn--small btn--plain good"),
       btn("Name", async () => { const n = prompt("A name for this machine (e.g. Staff entrance)", m.name); if (n != null) { await post("device", { sn: m.sn, name: n }); loadSettings(); } }),
       btn("Remove", async () => { if (confirm("Remove this machine from the list? It will appear again, waiting for approval, the next time it connects.")) { await post("device", { sn: m.sn, remove: true }); loadSettings(); } }, DANGER)]
    ]), { empty: "No machine has connected yet. Follow \"How to connect the machine\" below; it appears here within a minute." });
    $("[data-dev-howto]").open = !j.machines.length;
    machinePill(j.machines);
    renderPush(j).catch(e => console.error(e));
  }

  /* the roster's shifts: a name, when it starts and when it ends */
  function addShiftRow(s = { name: "", start: "", end: "" }) {
    const row = el("div", { className: "shiftrow" },
      el("input", { type: "text", value: s.name, maxlength: 24, "aria-label": "Shift name", placeholder: "Shift name" }),
      el("input", { type: "time", value: s.start, "aria-label": "Starts" }),
      el("input", { type: "time", value: s.end, "aria-label": "Ends" }));
    row.append(btn("Remove", () => row.remove(), DANGER));
    $("[data-shifts]").append(row);
  }
  $("[data-shift-add]").addEventListener("click", () => addShiftRow());

  /* On this phone: text size, and how Today is shown */
  $("[data-size]").value = stored(SIZE_KEY);
  $("[data-size]").addEventListener("change", e => { keep2(SIZE_KEY, e.target.value); applySize(e.target.value); });
  $("[data-view-pref]").value = view;
  $("[data-view-pref]").addEventListener("change", e => setView(e.target.value));

  /* --------------------------------------------------------------- backup */
  function backupYears() {
    const sel = $("[data-backup-year]"), now = +today().slice(0, 4);
    if (sel.options.length) return;
    for (let y = now; y >= 2026; y--) sel.append(el("option", { value: String(y) }, String(y)));
  }
  $("[data-backup]").addEventListener("click", async () => {
    const m = $("[data-backup-msg]"), year = $("[data-backup-year]").value;
    msg(m, "Preparing…", true);
    const r = await api("backup", { query: { year } });
    if (!r.ok) return msg(m, errText(r));
    const blob = new Blob([JSON.stringify(r.json, null, 1)], { type: "application/json" });
    const a = el("a", { href: URL.createObjectURL(blob), download: `hotel-perfect-plaza-attendance-backup-${year}-made-${today()}.json` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    msg(m, `Downloaded: ${r.json.staff.length} staff, ${r.json.punches.length} punches in ${year}. Keep the file somewhere safe.`, true);
  });

  /* ------------------------------------- app notifications on this phone */
  const canPush = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const b64bytes = s => { s = s.replace(/-/g, "+").replace(/_/g, "/"); s += "=".repeat((4 - s.length % 4) % 4); return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
  let pushKey = "";
  async function mySub() {
    if (!canPush) return null;
    const reg = await navigator.serviceWorker.getRegistration("/attendance");
    return reg ? reg.pushManager.getSubscription() : null;
  }
  async function renderPush(j) {
    pushKey = j.push.key;
    const state = $("[data-push-state]"), on = $("[data-push-on]"), off = $("[data-push-off]"), test = $("[data-push-test]");
    const sub = await mySub().catch(() => null);
    const mine = sub && j.devices.some(d => d.endpoint === sub.endpoint);
    const say = (text, cls) => { state.textContent = text; state.className = "notestate " + (cls || ""); };
    on.hidden = off.hidden = true;
    test.hidden = !j.devices.length && !j.chats.length;
    if (!j.push.ready) say("App notifications aren't switched on for the hotel's website yet.", "off");
    else if (!canPush) say(isIOS && !standalone
      ? "On iPhone: first put this app on the home screen (\"The app on a phone\" above), open it from there, then come back here."
      : "This browser can't show notifications. Open the page in Chrome (Android) or Safari (iPhone).", "off");
    else if (Notification.permission === "denied") say("Notifications are blocked for this app. Allow them in the phone's settings (Settings → Apps or Notifications → हाजिरी or Chrome), then come back.", "off");
    else if (mine) { say("On: this phone gets a notification every time someone punches.", "on"); off.hidden = false; }
    else { say("Off on this phone.", ""); on.hidden = false; }
    fill($("[data-push-table]"), ["Phone", "Turned on", "Last notification", ""], j.devices.map(d => [
      { v: [d.name, sub && d.endpoint === sub.endpoint ? el("small", {}, "this phone") : null], cls: "name" },
      nice(d.added), d.last_ok ? `${nice(d.last_ok.slice(0, 10))}, ${clock(d.last_ok.slice(11))}` : "—",
      btn("Remove", async () => { if (confirm(`Stop notifications on ${d.name}?`)) { await post("push-remove", { endpoint: d.endpoint }); loadSettings(); } }, DANGER)
    ]));
  }
  $("[data-push-on]").addEventListener("click", async () => {
    const m = $("[data-push-msg]");
    try {
      if (await Notification.requestPermission() !== "granted") return msg(m, "Notifications weren't allowed. Press the button again and choose Allow.");
      const reg = await navigator.serviceWorker.register("/attendance-sw.js", { scope: "/attendance" });
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64bytes(pushKey) });
      const guess = isIOS ? "iPhone" : /Android/.test(navigator.userAgent) ? "Android phone" : "Computer";
      const name = prompt("Whose phone is this? (e.g. Father's phone)", guess) || guess;
      const r = await post("push-subscribe", { subscription: sub.toJSON(), name });
      if (!r.ok) return msg(m, "Couldn't turn them on. Try again.");
      msg(m, "Turned on. Press \"Send a test\" to see one.", true);
      loadSettings();
    } catch (e) { console.error(e); msg(m, "Couldn't turn them on here (" + (e && e.message || e) + ")."); }
  });
  $("[data-push-off]").addEventListener("click", async () => {
    const sub = await mySub();
    if (sub) { await post("push-remove", { endpoint: sub.endpoint }); await sub.unsubscribe().catch(() => {}); }
    msg($("[data-push-msg]"), "Turned off on this phone.", true);
    loadSettings();
  });
  $("[data-push-test]").addEventListener("click", async () => {
    const r = await post("notify-test");
    msg($("[data-push-msg]"), r.ok ? (r.json.sent ? `Sent to ${r.json.sent} phone${r.json.sent > 1 ? "s" : ""}. It should appear in a few seconds.` : "No phone to send to yet.") : errText(r), r.ok && r.json.sent);
  });
  $("[data-set-form]").addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target, m = $("[data-set-msg]"), settings = {};
    for (const k of ["notify_in", "notify_out", "notify_summary", "notify_absent", "notify_month"]) settings[k] = f[k].checked ? "1" : "0";
    for (const k of ["lang", "shift_start", "shift_end", "grace", "ot_min", "ot_multiplier", "ssf_employee", "ssf_employer", "absent_after", "quiet_from", "quiet_to"]) settings[k] = f[k].value;
    if (!settings.quiet_from !== !settings.quiet_to) { msg(m, "Give both quiet-hours times, or leave both empty."); return; }
    settings.shifts = JSON.stringify($$("[data-shifts] .shiftrow").map(row => {
      const [name, start, end] = $$("input", row).map(i => i.value.trim());
      return { name, start, end };
    }).filter(s => s.name && s.start && s.end));
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

  /* ---------------------------------------------------------- the app */
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  $("[data-app-url]").textContent = MACHINE_HOST + "/attendance.html";
  $("[data-app-done]").hidden = !standalone;
  $("[data-app-howto]").hidden = standalone;
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("/attendance-sw.js", { scope: "/attendance" }).catch(() => {});
  let installer = null;
  const installButtons = () => [$("[data-install]"), $("[data-install-card]")];
  addEventListener("beforeinstallprompt", e => {
    e.preventDefault(); installer = e;
    installButtons().forEach(b => { b.hidden = false; });
  });
  installButtons().forEach(b => b.addEventListener("click", async () => {
    if (!installer) return;
    installer.prompt();
    await installer.userChoice.catch(() => {});
    installer = null; installButtons().forEach(x => { x.hidden = true; });
  }));
  addEventListener("appinstalled", () => installButtons().forEach(b => { b.hidden = true; }));
  /* back in the app after a while: show what changed straight away */
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && pass && current === "day" && $("[data-day-date]").value === today()) loadDay().catch(() => {});
  });

  /* ------------------------------------------------------------ language */
  function applyLang() {
    document.documentElement.lang = lang;
    $$("[data-lang]").forEach(b => { b.textContent = lang === "ne" ? "English" : "नेपाली"; b.lang = lang === "ne" ? "en" : "ne"; });
    if (lang === "ne") { window.HPP_NE.translate(document.body); document.title = T(document.title); }
  }
  if (window.HPP_NE) new MutationObserver(list => {
    if (lang === "ne") for (const m of list) m.addedNodes.forEach(n => window.HPP_NE.translate(n));
  }).observe(document.body, { childList: true, subtree: true });
  $$("[data-lang]").forEach(b => b.addEventListener("click", () => {
    const next = lang === "ne" ? "en" : "ne";
    try { localStorage.setItem(LANG_KEY, next); } catch (e) {}
    if (next === "en" || !window.HPP_NE) return location.reload();   /* back to English: the page as written */
    lang = "ne"; applyLang();
  }));
  applyLang();

  /* ------------------------------------------------------------ calendar */
  function applyCal() {
    const bs = cal === "bs";
    $$("[data-cal]").forEach(b => { b.hidden = !ND; b.textContent = bs ? "AD" : "वि.सं."; b.title = bs ? "Show English (AD) dates" : "Show Nepali (वि.सं.) dates"; });
    $("[data-rep-ad]").hidden = bs; $("[data-rep-bs]").hidden = !bs;
  }
  $$("[data-cal]").forEach(b => b.addEventListener("click", () => {
    try { localStorage.setItem(CAL_KEY, cal === "bs" ? "ad" : "bs"); } catch (e) {}
    location.reload();                                              /* every date on the page, redrawn */
  }));
  applyCal();

  if (pass) start().catch(() => {});
})();
