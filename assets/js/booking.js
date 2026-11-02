/* ==========================================================================
   Hotel Perfect Plaza — booking a room online
   --------------------------------------------------------------------------
   The "Book your stay" dialog in index.html:

     1  dates and guests → the room types free for those dates, with prices
        (from /api/availability); pick one, how many rooms, and breakfast
     2  the guest's details and the booking terms
     3  /api/book holds the rooms for 20 minutes and returns a signed eSewa
        form; this page posts it, and the guest pays on eSewa. eSewa sends
        them back to booking.html, which confirms the payment.

   Opened by every [data-book-open] ("Book now"), by the availability bar in
   the hero, and by the room cards (main.js), which pass the room along.
   Prices shown here are worked out the same way as on the server
   (api/_lib/rooms.js), but the server's total is the one charged.

   It only switches on once /api/availability?ping=1 says booking is set
   up (see the foot of this file); until then "Book now" goes to the
   enquiry form as before. If the server stops answering later, the dialog
   says so and offers the enquiry form instead.

   Text the script writes is in both languages here (T); text in the
   dialog's markup is translated by i18n.js like the rest of the page.
   ========================================================================== */

(function () {
  "use strict";

  const box = document.querySelector("[data-booking]");
  if (!box || typeof box.showModal !== "function") return;

  const $ = (s, r = box) => r.querySelector(s);
  const lang = () => (window.HPP_I18N ? window.HPP_I18N.get() : "en");
  const NE = window.HPP_NE || {};

  /* ------------------------------------------------------------- words */
  const T = {
    en: {
      pick: "Choose your check-in and check-out dates to see which rooms are free.",
      loading: "Checking which rooms are free…",
      nights: n => n === 1 ? "1 night" : n + " nights",
      roomsN: n => n === 1 ? "1 room" : n + " rooms",
      upTo: n => "up to " + n + (n === 1 ? " guest" : " guests"),
      perNight: "a night",
      left: n => n === 1 ? "1 left" : n + " left",
      soldOut: "Fully booked",
      tooFew: n => "Only " + n + " left",
      notOnline: "Ask us",
      none: "Nothing is free online for these dates. Call or WhatsApp us — we may still have a room.",
      rooms: "Rooms",
      breakfast: p => "Add breakfast (" + p + " per room, per night)",
      extra: (n, p) => (n === 1 ? "Includes 1 extra person" : "Includes " + n + " extra people") + " at " + p + " a night",
      tooMany: "Too many guests for this room — add a room or choose a bigger one.",
      total: "Total",
      chooseRoom: "Choose a room to continue.",
      pay: p => "Pay " + p + " with eSewa",
      going: "Taking you to eSewa to pay…",
      err: {
        name: "Add your name.", email: "Check your email address.", phone: "Add a phone number we can reach you on.",
        accept: "Please tick to agree to the booking terms.", full: "Sorry — that room was just taken for these dates. Please choose another.",
        past: "Check-in can't be in the past.", dates: "Check-out needs to come after check-in.", long: "Online bookings are up to 30 nights — call us for longer stays.",
        far: "Online bookings open up to a year ahead.", capacity: "Too many guests for that room.", rooms: "Choose how many rooms.",
        guests: "Check the number of guests.", net: "We couldn't reach the booking system. Check your connection and try again.",
        down: "Online booking isn't available right now.", server: "Something went wrong on our side. Please try again, or call us."
      },
      enquire: "Send us an enquiry instead",
      summary: (room, dates, guests) => room + " · " + dates + " · " + guests,
      guestsN: n => n === 1 ? "1 guest" : n + " guests",
      withBreakfast: "with breakfast"
    },
    ne: {
      pick: "कुन कोठा खाली छ हेर्न चेक-इन र चेक-आउट मिति छान्नुहोस्।",
      loading: "खाली कोठा हेर्दै…",
      nights: n => n + " रात",
      roomsN: n => n + " कोठा",
      upTo: n => "बढीमा " + n + " जना",
      perNight: "प्रतिरात",
      left: n => n + " वटा बाँकी",
      soldOut: "सबै बुक भइसक्यो",
      tooFew: n => n + " वटा मात्र बाँकी",
      notOnline: "हामीलाई सोध्नुहोस्",
      none: "यी मितिका लागि अनलाइनमा कुनै कोठा खाली छैन। फोन वा WhatsApp गर्नुहोस् — कोठा मिल्न सक्छ।",
      rooms: "कोठा संख्या",
      breakfast: p => "बिहानको नास्ता थप्नुहोस् (प्रति कोठा, प्रतिरात " + p + ")",
      extra: (n, p) => "थप " + n + " जनाको प्रतिरात " + p + " समावेश",
      tooMany: "यो कोठाका लागि पाहुना धेरै भए — अर्को कोठा थप्नुहोस् वा ठूलो कोठा छान्नुहोस्।",
      total: "जम्मा",
      chooseRoom: "अगाडि बढ्न कोठा छान्नुहोस्।",
      pay: p => "eSewa बाट " + p + " तिर्नुहोस्",
      going: "भुक्तानीका लागि eSewa मा लैजाँदै…",
      err: {
        name: "आफ्नो नाम लेख्नुहोस्।", email: "इमेल ठेगाना जाँच्नुहोस्।", phone: "सम्पर्क गर्न मिल्ने फोन नम्बर लेख्नुहोस्।",
        accept: "बुकिङ सर्तमा सहमति जनाउन टिक लगाउनुहोस्।", full: "माफ गर्नुहोस् — यी मितिका लागि त्यो कोठा भर्खरै बुक भयो। अर्को कोठा छान्नुहोस्।",
        past: "चेक-इन मिति बितिसकेको हुन सक्दैन।", dates: "चेक-आउट मिति चेक-इनपछि हुनुपर्छ।", long: "अनलाइन बुकिङ बढीमा ३० रातसम्म — लामो बसाइका लागि फोन गर्नुहोस्।",
        far: "अनलाइन बुकिङ एक वर्षभित्रका लागि मात्र।", capacity: "त्यो कोठाका लागि पाहुना धेरै भए।", rooms: "कोठा संख्या छान्नुहोस्।",
        guests: "पाहुना संख्या जाँच्नुहोस्।", net: "बुकिङ प्रणालीसँग जोडिन सकिएन। इन्टरनेट जाँचेर फेरि प्रयास गर्नुहोस्।",
        down: "अहिले अनलाइन बुकिङ उपलब्ध छैन।", server: "हाम्रो तर्फबाट केही गडबड भयो। फेरि प्रयास गर्नुहोस्, वा फोन गर्नुहोस्।"
      },
      enquire: "बरु सोधपुछ पठाउनुहोस्",
      summary: (room, dates, guests) => room + " · " + dates + " · " + guests,
      guestsN: n => n + " जना पाहुना",
      withBreakfast: "नास्तासहित"
    }
  };
  const t = () => T[lang()] || T.en;
  const npr = n => (lang() === "ne" ? "रु. " : "NPR ") + Number(n).toLocaleString("en-US");
  const roomName = r => (lang() === "ne" && NE[r.name]) || r.name;
  const fmtDay = iso => new Intl.DateTimeFormat(lang() === "ne" ? "ne-NP" : "en-GB",
    { day: "numeric", month: "short", timeZone: "UTC", numberingSystem: "latn" }).format(new Date(iso + "T00:00:00Z"));

  /* ------------------------------------------------------------ elements */
  const step1 = $('[data-step="1"]'), step2 = $('[data-step="2"]'), step3 = $('[data-step="3"]');
  const fIn = $("#b-in"), fOut = $("#b-out"), fGuests = $("#b-guests");
  const list = $("[data-book-rooms]"), status1 = $("[data-book-status]"), totalEl = $("[data-book-total]");
  const summary = $("[data-book-summary]"), payBtn = $("[data-book-pay]"), status2 = $("[data-book-status2]");
  const testNote = $("[data-book-test]");
  if (window.HPP && window.HPP.linkDates) window.HPP.linkDates(fIn, fOut);

  /* ---------------------------------------------------------------- state */
  let data = null;            /* the last /api/availability reply */
  let pick = { code: null, rooms: 1, breakfast: false };
  let wantRoom = null;        /* a room asked for when opening (by its form name) */
  let opener = null, loadSeq = 0, down = false;

  /* The same sums as api/_lib/rooms.js: quote(). */
  function price(r, rooms, breakfast) {
    if (!data) return null;
    const p = data.pricing, guests = +fGuests.value || 1, nights = data.nights;
    const extra = Math.max(0, guests - rooms * r.maxGuests);
    if (extra > rooms * p.maxExtraPerRoom || guests < rooms) return null;
    const sub = nights * (rooms * r.rate + extra * p.extraPerson + (breakfast ? rooms * r.breakfast : 0));
    const service = Math.round(sub * p.serviceCharge), vat = Math.round((sub + service) * p.vat);
    return { total: sub + service + vat, extra };
  }
  /* the fewest rooms that fit the party (one extra guest per room allowed),
     but enough that nobody pays the extra-person charge if a room is free */
  function roomsFor(r) {
    const guests = +fGuests.value || 1;
    const min = Math.ceil(guests / (r.maxGuests + data.pricing.maxExtraPerRoom));
    const comfy = Math.ceil(guests / r.maxGuests);
    return comfy <= r.left ? comfy : min;
  }

  /* --------------------------------------------------------------- step 1 */
  function setStatus(el, text, bad) { el.textContent = text || ""; el.classList.toggle("is-bad", !!bad); }

  async function load() {
    pick.code = pick.code && data ? pick.code : null;
    const a = fIn.value, b = fOut.value;
    if (!a || !b || b <= a) {
      data = null; render();
      setStatus(status1, a && b ? t().err.dates : t().pick, a && b);
      return;
    }
    const seq = ++loadSeq;
    setStatus(status1, t().loading);
    list.setAttribute("aria-busy", "true");
    let res, json;
    try {
      res = await fetch("/api/availability?" + new URLSearchParams({ in: a, out: b }), { headers: { Accept: "application/json" } });
      json = await res.json();
    } catch (e) {
      if (seq !== loadSeq) return;
      list.removeAttribute("aria-busy");
      return unavailable(location.protocol === "file:" ? "down" : "net");
    }
    if (seq !== loadSeq) return;
    list.removeAttribute("aria-busy");
    if (!res.ok) {
      data = null; render();
      if (res.status >= 500) return unavailable("down");
      return setStatus(status1, t().err[json.error] || t().err.server, true);
    }
    down = false;
    data = json;
    testNote.hidden = data.payment !== "test";
    let reveal = false;
    if (wantRoom) {
      const r = data.rooms.find(x => x.name === wantRoom || x.code === wantRoom);
      if (r && r.left > 0) { pick = { code: r.code, rooms: roomsFor(r), breakfast: false }; reveal = true; }
      wantRoom = null;
    }
    const cur = pick.code && data.rooms.find(x => x.code === pick.code);
    if (cur && (cur.left < 1 || !price(cur, Math.min(pick.rooms, cur.left), pick.breakfast))) pick.code = null;
    if (cur && pick.rooms > cur.left) pick.rooms = Math.max(1, cur.left);
    render();
    /* the room asked for (from its card) may be below the fold */
    const picked = reveal && list.querySelector(".broom.is-picked");
    if (picked) picked.scrollIntoView({ block: "center" });
  }

  function unavailable(kind) {
    down = true; data = null; render();
    status1.textContent = "";
    status1.classList.add("is-bad");
    status1.append(t().err[kind] + " ");
    const a = document.createElement("a");
    a.href = "#enquire"; a.className = "book__enquire"; a.textContent = t().enquire;
    a.addEventListener("click", e => { e.preventDefault(); toEnquiry(); });
    status1.append(a);
  }

  function render() {
    list.textContent = "";
    if (!data) { totalEl.textContent = ""; return; }
    const tt = t();
    setStatus(status1, tt.nights(data.nights) + " · " + fmtDay(data.checkIn) + " – " + fmtDay(data.checkOut));
    let any = false;
    data.rooms.forEach(r => {
      const need = roomsFor(r);
      const ok = r.left >= 1 && r.left >= Math.ceil((+fGuests.value || 1) / (r.maxGuests + data.pricing.maxExtraPerRoom));
      if (ok) any = true;
      const selected = pick.code === r.code;
      const rooms = selected ? pick.rooms : need;
      const pr = price(r, Math.min(rooms, Math.max(r.left, 1)), selected && pick.breakfast);
      const [title, sub] = roomName(r).split(" — ");

      const item = document.createElement("div");
      item.className = "broom" + (selected ? " is-picked" : "") + (ok ? "" : " is-off");
      item.innerHTML =
        '<label class="broom__row"><input class="broom__radio" type="radio" name="b-room"' + (ok ? "" : " disabled") + '>' +
        '<span class="broom__main"><strong class="broom__name"></strong><span class="broom__sub"></span></span>' +
        '<span class="broom__price"><strong></strong><span></span></span>' +
        '<span class="broom__left"></span></label>';
      const radio = item.querySelector("input");
      radio.value = r.code; radio.checked = selected;
      item.querySelector(".broom__name").textContent = title;
      item.querySelector(".broom__sub").textContent = (sub ? sub + " · " : "") + tt.upTo(r.maxGuests);
      item.querySelector(".broom__price strong").textContent = npr(r.rate);
      item.querySelector(".broom__price span").textContent = tt.perNight;
      const leftEl = item.querySelector(".broom__left");
      leftEl.textContent = r.left < 1 ? (r.left === 0 && data.rooms.every(x => x.left === 0) ? tt.notOnline : tt.soldOut)
        : ok ? tt.left(r.left) : tt.tooFew(r.left);
      leftEl.classList.toggle("is-low", ok && r.left <= 2);
      radio.addEventListener("change", () => { pick = { code: r.code, rooms: roomsFor(r), breakfast: false }; render(); });

      if (selected) {
        const opts = document.createElement("div");
        opts.className = "broom__opts";
        const max = Math.min(r.left, data.pricing.maxRooms);
        opts.innerHTML =
          '<label class="broom__count"><span></span><select></select></label>' +
          '<label class="broom__bf"><input type="checkbox"><span></span></label>' +
          '<p class="broom__note"></p>';
        opts.querySelector(".broom__count span").textContent = tt.rooms;
        const sel = opts.querySelector("select");
        for (let n = 1; n <= max; n++) { const o = document.createElement("option"); o.value = n; o.textContent = n; sel.append(o); }
        sel.value = String(Math.min(pick.rooms, max));
        sel.addEventListener("change", () => { pick.rooms = +sel.value; render(); });
        const bf = opts.querySelector(".broom__bf input");
        bf.checked = pick.breakfast;
        opts.querySelector(".broom__bf span").textContent = tt.breakfast(npr(r.breakfast));
        bf.addEventListener("change", () => { pick.breakfast = bf.checked; render(); });
        const note = opts.querySelector(".broom__note");
        if (!pr) { note.textContent = tt.tooMany; note.classList.add("is-bad"); }
        else if (pr.extra) note.textContent = tt.extra(pr.extra, npr(data.pricing.extraPerson));
        else note.hidden = true;
        item.append(opts);
      }
      list.append(item);
    });
    if (!any) setStatus(status1, tt.none, true);
    updateTotal();
  }

  function current() {
    if (!data || !pick.code) return null;
    const r = data.rooms.find(x => x.code === pick.code);
    const pr = r && price(r, pick.rooms, pick.breakfast);
    return pr ? { r, ...pr } : null;
  }
  function updateTotal() {
    const c = current();
    totalEl.textContent = "";
    if (!c) return;
    const strong = document.createElement("strong");
    strong.textContent = npr(c.total);
    const more = document.createElement("span");
    more.className = "book__more";
    more.textContent = " · " + t().nights(data.nights) + ", " + t().roomsN(pick.rooms);
    totalEl.append(t().total + " ", strong, more);
  }

  step1.addEventListener("submit", e => {
    e.preventDefault();
    if (!current()) { setStatus(status1, data ? t().chooseRoom : (down ? status1.textContent : t().pick), true); return; }
    go(2);
  });
  [fIn, fOut].forEach(el => el.addEventListener("change", load));
  let gTimer;
  fGuests.addEventListener("input", () => { clearTimeout(gTimer); gTimer = setTimeout(() => { if (data) { pick.code && (pick.rooms = roomsFor(data.rooms.find(x => x.code === pick.code))); render(); } }, 250); });

  /* --------------------------------------------------------------- step 2 */
  function fillSummary() {
    const c = current();
    const tt = t();
    summary.textContent = "";
    const line = document.createElement("p");
    line.textContent = tt.summary(
      (pick.rooms > 1 ? pick.rooms + " × " : "") + roomName(c.r),
      fmtDay(data.checkIn) + " – " + fmtDay(data.checkOut) + " (" + tt.nights(data.nights) + ")",
      tt.guestsN(+fGuests.value || 1) + (pick.breakfast ? ", " + tt.withBreakfast : ""));
    const tot = document.createElement("p");
    tot.className = "book__sumtotal";
    const s = document.createElement("strong"); s.textContent = npr(c.total);
    tot.append(tt.total + " ", s);
    summary.append(line, tot);
    payBtn.textContent = tt.pay(npr(c.total));
  }

  const fields = { name: $("#b-name"), email: $("#b-email"), phone: $("#b-phone") };
  const setErr = (id, bad) => {
    const f = $("#" + id), n = $('[data-err="' + id + '"]');
    if (f && f.closest(".field")) f.closest(".field").classList.toggle("is-bad", bad);
    if (n) n.hidden = !bad;
  };

  step2.addEventListener("submit", async e => {
    e.preventDefault();
    setStatus(status2, "");
    const bad = {
      "b-name": !fields.name.value.trim(),
      "b-email": !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(fields.email.value.trim()),
      "b-phone": fields.phone.value.replace(/\D/g, "").length < 7,
      "b-accept": !$("#b-accept").checked
    };
    Object.keys(bad).forEach(id => setErr(id, bad[id]));
    const first = Object.keys(bad).find(id => bad[id]);
    if (first) { $("#" + first).focus(); return; }

    payBtn.disabled = true;
    let res, json;
    try {
      res = await fetch("/api/book", {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          room: pick.code, checkIn: data.checkIn, checkOut: data.checkOut, rooms: pick.rooms,
          guests: +fGuests.value || 1, breakfast: pick.breakfast,
          name: fields.name.value, email: fields.email.value, phone: fields.phone.value,
          notes: $("#b-notes").value, accept: $("#b-accept").checked, website: $("#b-website").value
        })
      });
      json = await res.json();
    } catch (err) {
      payBtn.disabled = false;
      return setStatus(status2, t().err.net, true);
    }
    if (!res.ok) {
      payBtn.disabled = false;
      if (json.error === "full") { go(1); load(); setStatus(status1, t().err.full, true); return; }
      if (["name", "email", "phone", "accept"].includes(json.error)) { setErr("b-" + json.error, true); return setStatus(status2, t().err[json.error], true); }
      return setStatus(status2, t().err[json.error] || t().err.server, true);
    }
    /* booking.html uses this if eSewa sends the guest back without its data */
    try { sessionStorage.setItem("hpp-booking", JSON.stringify({ id: json.id, t: json.form.fields.transaction_uuid })); } catch (err) {}
    go(3);
    const f = document.createElement("form");
    f.method = "POST"; f.action = json.form.action; f.hidden = true;
    Object.entries(json.form.fields).forEach(([k, v]) => {
      const i = document.createElement("input"); i.type = "hidden"; i.name = k; i.value = v; f.append(i);
    });
    document.body.append(f);
    f.submit();
  });

  $("[data-book-back]").addEventListener("click", () => go(1));

  /* ------------------------------------------------------------ the steps */
  function go(n) {
    step1.hidden = n !== 1; step2.hidden = n !== 2; step3.hidden = n !== 3;
    box.querySelectorAll("[data-step-mark]").forEach(li => li.classList.toggle("is-on", +li.dataset.stepMark <= n));
    box.dataset.at = n;
    if (n === 2) { fillSummary(); setStatus(status2, ""); fields.name.focus(); }
    if (n === 3) $("[data-book-going]").textContent = t().going;
    if (n === 1) { const r = list.querySelector("input:checked") || fIn; r.focus(); }
  }

  /* ------------------------------------------------------ open and close */
  function open(o = {}) {
    opener = document.activeElement;
    if (o.checkIn) fIn.value = o.checkIn;
    if (o.checkOut) fOut.value = o.checkOut;
    if (o.guests) fGuests.value = o.guests;
    if (o.room) { wantRoom = o.room; pick.code = null; }
    if (fIn.value && fIn.min && fIn.value < fIn.min) fIn.value = "";
    if (fOut.value && fIn.value && fOut.value <= fIn.value) fOut.value = "";
    go(1);
    document.documentElement.classList.add("book-open");
    box.showModal();
    load();
    (fIn.value ? (fOut.value ? null : fOut) : fIn)?.focus();
  }

  function toEnquiry() {
    const set = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
    set("f-in", fIn.value); set("f-out", fOut.value); set("f-guests", fGuests.value);
    const r = data && pick.code && data.rooms.find(x => x.code === pick.code);
    if (r) set("f-room", r.name);
    shut();
    const target = document.getElementById("enquire");
    if (target) { target.scrollIntoView({ block: "start" }); const n = document.getElementById("f-name"); if (n) setTimeout(() => n.focus({ preventScroll: true }), 600); }
  }

  /* Unlock the page and give focus back straight away: the dialog's own
     "close" event (which also covers Escape) can arrive a second late. */
  const done = () => {
    if (!document.documentElement.classList.contains("book-open")) return;
    document.documentElement.classList.remove("book-open");
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  };
  const shut = () => { box.close(); done(); };
  box.addEventListener("close", done);
  $("[data-booking-close]").addEventListener("click", shut);
  box.addEventListener("click", e => { if (e.target === box) shut(); });
  /* on the way to eSewa, Escape must not leave a half-finished page */
  box.addEventListener("cancel", e => { if (box.dataset.at === "3") e.preventDefault(); });

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-book-open]");
    if (!ready || !b || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    open({ room: b.dataset.bookOpen || null });
  }, true);   /* capture: before main.js scrolls the link to the enquiry form */

  /* re-write the script's own text in the other language */
  document.addEventListener("hpp:lang", () => {
    if (!box.open) return;
    if (box.dataset.at === "2") fillSummary();
    if (down) unavailable("down"); else if (data) render(); else load();
  });

  /* Online booking switches itself on: only once the server says it is
     ready (database connected, rooms entered on admin.html) do "Book now",
     the hero bar and the room cards open this dialog. Until then — or with
     no server at all, as when the page is opened from disk — they go to
     the enquiry form as they always have. */
  let ready = false;
  const wantsBook = new URLSearchParams(location.search).has("book");   /* "Try again" on booking.html */
  if (wantsBook) { try { history.replaceState(history.state, "", location.pathname); } catch (e) {} }

  /* While eSewa is in test mode, online booking shows only in a browser
     that has opened the site once with ?booking-test=1 (and ?booking-test=0
     turns that off again) — so the hotel can try it without guests seeing
     eSewa's test payment page. */
  let tester = false;
  try {
    const flag = new URLSearchParams(location.search).get("booking-test");
    if (flag === "1") localStorage.setItem("hpp-booking-test", "1");
    if (flag === "0") localStorage.removeItem("hpp-booking-test");
    if (flag !== null) history.replaceState(history.state, "", location.pathname);
    tester = localStorage.getItem("hpp-booking-test") === "1";
  } catch (e) { /* private mode: no tester */ }

  fetch("/api/availability?ping=1" + (tester ? "&test=1" : ""), { headers: { Accept: "application/json" } })
    .then(r => r.ok ? r.json() : null)
    .then(j => {
      if (!j || !j.ready) return;
      ready = true;
      window.HPP_BOOK = {
        open,
        /* main.js: is this a room type the dialog can book? */
        isRoom: name => /^(Single Room|Deluxe Room|Deluxe Twin Room|Superior Room|Deluxe Four-Bed Room|Family Suite) — /.test(name || "")
      };
      if (wantsBook) open({});
    })
    .catch(() => { /* no booking server: the enquiry form it is */ });
})();
