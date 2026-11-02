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
    await Promise.all([loadGrid(), loadList()]);
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

  if (pass) start().catch(() => {}); else signOut("");
})();
