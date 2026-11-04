/* admin.html — the front desk's bookings page. Talks to /api/admin with
   the password the desk signs in with (kept for this browser tab only). */

(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const KEY = "hpp-admin";
  let pass = null;
  try { pass = sessionStorage.getItem(KEY); } catch (e) {}

  const npr = n => "NPR " + Number(n || 0).toLocaleString("en-US");
  const today = () => new Date(Date.now() + 345 * 60000).toISOString().slice(0, 10);   /* Nepal, UTC+5:45 */
  const addDays = (s, n) => new Date(Date.parse(s + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
  const short = s => new Date(s + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const msg = (el, text, ok) => { el.textContent = text || ""; el.className = "msg" + (el.classList.contains("wide") ? " wide" : "") + (text ? (ok ? " ok" : " bad") : ""); };
  const cell = (tr, text, cls) => { const td = document.createElement("td"); td.textContent = text == null ? "" : text; if (cls) td.className = cls; tr.append(td); return td; };

  async function api(action, { method = "GET", query = {}, body } = {}) {
    const res = await fetch("/api/admin?" + new URLSearchParams({ action, ...query }), {
      method, headers: { Authorization: "Bearer " + pass, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    let json = {}; try { json = await res.json(); } catch (e) {}
    if (res.status === 401) { signOut("Wrong password."); throw new Error("password"); }
    if (res.status === 503) { signOut("The booking system isn't set up yet (ADMIN_PASSWORD or the database is missing)."); throw new Error("setup"); }
    return { ok: res.ok, status: res.status, json };
  }

  /* ------------------------------------------------------------- sign in */
  function signOut(text) {
    pass = null; try { sessionStorage.removeItem(KEY); } catch (e) {}
    $("[data-app]").hidden = true; $("[data-login]").hidden = false; $("[data-logout]").hidden = true;
    msg($("[data-login-msg]"), text || "");
  }
  async function start() {
    $("[data-login]").hidden = true; $("[data-app]").hidden = false; $("[data-logout]").hidden = false;
    $("[data-grid-from]").value ||= today();
    $("[data-list-from]").value ||= addDays(today(), -1);
    $("[data-list-to]").value ||= addDays(today(), 30);
    await loadRooms();
    await Promise.all([loadGrid(), loadList(), loadToday()]);
    clearInterval(timer);
    timer = setInterval(() => { if (pass) Promise.all([loadToday(), loadList(), loadGrid()]).catch(() => {}); }, 60000);
  }
  $("[data-login]").addEventListener("submit", async e => {
    e.preventDefault();
    pass = $("#pw").value;
    try {
      const r = await api("rooms");
      if (r.ok) { try { sessionStorage.setItem(KEY, pass); } catch (err) {} start(); }
    } catch (err) { /* message already shown */ }
  });
  $("[data-logout]").addEventListener("click", () => signOut(""));

  /* ---------------------------------------------------------- room counts */
  let rooms = [];
  async function loadRooms() {
    const r = await api("rooms");
    rooms = r.json.rooms || [];
    const mode = $("[data-mode]");
    mode.hidden = false;
    mode.textContent = r.json.payment === "live" ? "eSewa LIVE — guests can book online" : "eSewa TEST mode — guests can't book online yet; open the site with ?booking-test=1 to try it";
    const box = $("[data-counts]"); box.textContent = "";
    const sel = $("[data-room-select]"); sel.textContent = "";
    rooms.forEach(rm => {
      const l = document.createElement("label");
      l.append(rm.name);
      const i = document.createElement("input"); i.type = "number"; i.min = 0; i.max = 500; i.value = rm.count; i.name = rm.code;
      l.append(i); box.append(l);
      const o = document.createElement("option"); o.value = rm.code; o.textContent = rm.name; sel.append(o);
    });
    if (rooms.every(x => !x.count)) msg($("[data-rooms-msg]"), "No rooms are set yet, so the website shows every room as unavailable. Enter how many rooms of each type the hotel has and save.");
  }
  $("[data-rooms]").addEventListener("submit", async e => {
    e.preventDefault();
    const counts = {};
    e.target.querySelectorAll("[data-counts] input").forEach(i => { counts[i.name] = Number(i.value); });
    const r = await api("rooms", { method: "POST", body: { counts } });
    msg($("[data-rooms-msg]"), r.ok ? "Saved." : "Could not save: check the numbers.", r.ok);
    if (r.ok) { await loadRooms(); loadGrid(); }
  });

  /* ------------------------------------------------------------- the grid */
  async function loadGrid() {
    const r = await api("grid", { query: { from: $("[data-grid-from]").value, days: 14 } });
    const t = $("[data-grid]"); t.textContent = "";
    const head = document.createElement("tr");
    const th0 = document.createElement("th"); th0.textContent = "Room type"; head.append(th0);
    r.json.nights.forEach(n => {
      const th = document.createElement("th"); th.textContent = short(n);
      if (/^(Sat|Sun)/.test(short(n))) th.className = "we";
      head.append(th);
    });
    t.append(head);
    r.json.rooms.forEach(rm => {
      const tr = document.createElement("tr");
      cell(tr, rm.name);
      rm.left.forEach(n => cell(tr, n, n < 0 ? "neg" : n === 0 ? "zero" : ""));
      t.append(tr);
    });
  }
  $("[data-grid-from]").addEventListener("change", loadGrid);

  /* --------------------------------------------------------- the bookings */
  async function loadList() {
    const r = await api("bookings", { query: { from: $("[data-list-from]").value, to: $("[data-list-to]").value } });
    const all = $("[data-list-all]").checked;
    const rows = (r.json.bookings || []).filter(b => all || ["paid", "blocked", "paid_conflict"].includes(b.status) || (b.status === "pending" && !b.expired));
    const t = $("[data-list]"); t.textContent = "";
    const head = document.createElement("tr");
    ["Status", "Booking", "Room", "Check-in", "Check-out", "Guest", "Phone / email", "Paid", "Notes", ""].forEach(h => {
      const th = document.createElement("th"); th.textContent = h; head.append(th);
    });
    t.append(head);
    rows.forEach(b => {
      const tr = document.createElement("tr");
      const st = b.status === "pending" && b.expired ? "expired" : b.status;
      const label = { paid: "Paid", blocked: b.source === "staff" ? "Front desk" : "Blocked", pending: "Paying now", paid_conflict: "PAID — OVERBOOKED, call guest",
        failed: "Not paid", cancelled: "Cancelled", expired: "Not paid (expired)" }[st] || st;
      const chip = document.createElement("span"); chip.className = "chip " + st; chip.textContent = label;
      cell(tr, "").append(chip);
      cell(tr, b.id + "\n" + b.created_at).style.whiteSpace = "pre";
      cell(tr, (b.rooms > 1 ? b.rooms + " × " : "") + b.roomName + (b.breakfast ? " + breakfast" : ""), "wrap");
      cell(tr, short(b.check_in)); cell(tr, short(b.check_out));
      cell(tr, b.name + " (" + b.guests + ")", "wrap");
      const contact = cell(tr, "");
      if (b.phone) { const a = document.createElement("a"); a.href = "tel:" + b.phone; a.textContent = b.phone; contact.append(a, document.createElement("br")); }
      if (b.email) { const a = document.createElement("a"); a.href = "mailto:" + b.email; a.textContent = b.email; contact.append(a); }
      cell(tr, b.amount ? npr(b.amount) + (b.esewa_ref ? "\neSewa " + b.esewa_ref : "") : "").style.whiteSpace = "pre";
      cell(tr, b.notes, "wrap");
      const act = cell(tr, "");
      if (["paid", "blocked", "paid_conflict", "pending"].includes(b.status) && !b.expired) {
        const btn = document.createElement("button"); btn.className = "btn btn--small"; btn.type = "button"; btn.textContent = "Cancel";
        btn.addEventListener("click", async () => {
          const paid = b.status === "paid" || b.status === "paid_conflict";
          if (!confirm("Cancel " + b.id + " for " + b.name + "?" + (paid ? "\n\nThis frees the room. Refund the guest separately in the eSewa merchant portal." : ""))) return;
          const r2 = await api("cancel", { method: "POST", body: { id: b.id } });
          msg($("[data-list-msg]"), r2.ok ? b.id + " cancelled." : "Could not cancel " + b.id + ".", r2.ok);
          loadList(); loadGrid();
        });
        act.append(btn);
      }
      t.append(tr);
    });
    if (!rows.length) { const tr = document.createElement("tr"); cell(tr, "No bookings in these dates.").colSpan = 10; t.append(tr); }
  }
  ["[data-list-from]", "[data-list-to]", "[data-list-all]"].forEach(s => $(s).addEventListener("change", loadList));

  /* ------------------------------------------------------ walk-ins, blocks */
  $("[data-block]").addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target, v = n => f.elements[n].value;
    const r = await api("block", { method: "POST", body: {
      room: v("room"), rooms: Number(v("rooms")), checkIn: v("checkIn"), checkOut: v("checkOut"),
      name: v("name"), phone: v("phone"), notes: v("notes"), amount: Number(v("amount")) || 0, force: f.elements.force.checked
    } });
    const m = $("[data-block-msg]");
    if (r.ok) { msg(m, "Done: " + r.json.id + ". Those rooms are off the website for those nights.", true); f.reset(); loadGrid(); loadList(); }
    else msg(m, r.json.error === "full" ? "The website shows these rooms as full for some of those nights. Tick the box to record it anyway." :
      r.json.error === "dates" ? "Check the dates: check-out must be after check-in." : "Could not save: " + (r.json.error || r.status));
  });

  /* ------------------------------------------------ today, and new bookings
     Arrivals and departures for today, and an alert — on the page, in the
     tab's title, as a sound and (once allowed) a desktop notification —
     for every paid booking this browser hasn't seen yet. Checked every
     minute while the page is open: keep it open at the desk. */
  const HOLDING = ["paid", "blocked", "paid_conflict"];
  const SEEN = "hpp-admin-seen";
  const baseTitle = document.title;
  let seen = null, fresh = [], audio = null, timer = null;
  try { seen = new Set(JSON.parse(localStorage.getItem(SEEN) || "null")); } catch (e) { seen = null; }
  const saveSeen = () => { try { localStorage.setItem(SEEN, JSON.stringify([...seen].slice(-500))); } catch (e) {} };

  function fill(sel, rows) {
    const ul = $(sel); ul.textContent = "";
    if (!rows.length) { const li = document.createElement("li"); li.className = "none"; li.textContent = "None"; ul.append(li); return; }
    rows.forEach(b => {
      const li = document.createElement("li");
      const strong = document.createElement("strong"); strong.textContent = b.name;
      li.append(strong, " — " + (b.rooms > 1 ? b.rooms + " × " : "") + b.roomName + (b.breakfast ? ", breakfast" : "") + " · " + b.guests + " guest" + (b.guests > 1 ? "s" : ""));
      if (b.phone) { li.append(" · "); const a = document.createElement("a"); a.href = "tel:" + b.phone; a.textContent = b.phone; li.append(a); }
      if (b.status === "paid_conflict") li.classList.add("bad");
      ul.append(li);
    });
  }

  /* browsers allow sound only after a click on the page: get it ready on
     the first one (signing in, or the alerts button) */
  const wakeAudio = () => { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === "suspended") audio.resume(); } catch (e) {} };
  document.addEventListener("pointerdown", wakeAudio, { once: true });
  function beep() {
    if (!audio) return;
    try {
      [0, .25, .5].forEach(t => {
        const o = audio.createOscillator(), g = audio.createGain();
        o.frequency.value = 880; g.gain.setValueAtTime(.18, audio.currentTime + t); g.gain.exponentialRampToValueAtTime(.001, audio.currentTime + t + .2);
        o.connect(g).connect(audio.destination); o.start(audio.currentTime + t); o.stop(audio.currentTime + t + .22);
      });
    } catch (e) { /* no sound: the page and the title still show it */ }
  }

  function showAlert() {
    const box = $("[data-alert]");
    document.title = fresh.length ? "(" + fresh.length + ") New booking — " + baseTitle : baseTitle;
    if (!fresh.length) { box.hidden = true; return; }
    box.hidden = false; box.textContent = "";
    const conflict = fresh.some(b => b.status === "paid_conflict");
    box.className = "alert" + (conflict ? " alert--bad" : "");
    const head = document.createElement("strong");
    head.textContent = fresh.length === 1 ? "New booking" : fresh.length + " new bookings";
    box.append(head);
    const ul = document.createElement("ul");
    fresh.forEach(b => {
      const li = document.createElement("li");
      li.textContent = (b.status === "paid_conflict" ? "⚠ PAID BUT OVERBOOKED — call the guest: " : "") +
        b.id + " · " + b.name + " · " + (b.rooms > 1 ? b.rooms + " × " : "") + b.roomName + " · " + short(b.check_in) + " – " + short(b.check_out) + " · " + npr(b.amount) + (b.phone ? " · " + b.phone : "");
      ul.append(li);
    });
    const ok = document.createElement("button");
    ok.type = "button"; ok.className = "btn"; ok.textContent = "Seen";
    ok.addEventListener("click", () => { fresh.forEach(b => seen.add(b.id)); saveSeen(); fresh = []; showAlert(); });
    box.append(ul, ok);
  }

  async function loadToday() {
    const t = today();
    $("[data-today-date]").textContent = short(t);
    /* stays around today, plus everything booked in the last 3 days */
    const r = await api("bookings", { query: { from: addDays(t, -1), to: addDays(t, 1) } });
    const rows = r.json.bookings || [];
    fill("[data-arrive]", rows.filter(b => HOLDING.includes(b.status) && b.check_in === t));
    fill("[data-leave]", rows.filter(b => HOLDING.includes(b.status) && b.check_out === t));

    const paid = rows.filter(b => b.status === "paid" || b.status === "paid_conflict");
    if (!seen) { seen = new Set(paid.map(b => b.id)); saveSeen(); }   /* first visit: nothing is "new" */
    const before = fresh.length;
    fresh = paid.filter(b => !seen.has(b.id));
    if (fresh.length > before) {
      beep();
      if ("Notification" in window && Notification.permission === "granted") {
        const b = fresh[fresh.length - 1];
        try { new Notification("New booking — Hotel Perfect Plaza", { body: b.name + " · " + b.roomName + " · " + short(b.check_in) + " · " + npr(b.amount), tag: b.id }); } catch (e) {}
      }
    }
    showAlert();
    $("[data-refresh]").textContent = "Updated " + new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) + " · checks for new bookings every minute while this page is open.";
  }

  function alertsButton() {
    const b = $("[data-alerts]");
    const on = "Notification" in window && Notification.permission === "granted";
    b.textContent = on ? "Booking alerts on ✓" : "Turn on booking alerts";
    b.disabled = on;
  }
  $("[data-alerts]").addEventListener("click", async () => {
    wakeAudio(); beep();   /* a click lets the page play sound from now on */
    if ("Notification" in window) { try { await Notification.requestPermission(); } catch (e) {} }
    alertsButton();
  });
  alertsButton();

  if (pass) start().catch(() => {}); else signOut("");
})();
