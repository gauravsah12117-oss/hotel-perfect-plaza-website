/* ==========================================================================
   booking.html — the guest is back from eSewa
   --------------------------------------------------------------------------
   eSewa sends the guest to
     booking.html?data=<signed reply>      after paying
     booking.html?failed=<transaction id>  after cancelling or failing
   The server confirms a payment with eSewa itself (/api/esewa-verify)
   before anything says "booked"; while eSewa still reports it as pending,
   this page asks again every few seconds. Reloading is safe: the booking
   is only confirmed, and emailed, once.
   ========================================================================== */

(function () {
  "use strict";

  const card = document.querySelector("[data-result]");
  if (!card) return;
  const lang = () => (window.HPP_I18N ? window.HPP_I18N.get() : "en");
  const NE = window.HPP_NE || {};

  const T = {
    en: {
      paidTitle: "Your room is booked",
      paidLede: b => "Thank you, " + b.name + ". Your payment went through and your room is confirmed. A confirmation is on its way to " + b.email + ".",
      conflictTitle: "Payment received",
      conflictLede: b => "Thank you, " + b.name + ". Your payment reached us, but it took longer than the 20 minutes we hold a room, and these dates filled up meanwhile. Our front desk will call you on " + b.phone + " shortly to arrange your room or refund you in full.",
      pendingTitle: "Checking your payment…",
      pendingLede: "eSewa is still confirming your payment. This page will update by itself.",
      slowTitle: "Still waiting for eSewa",
      slowLede: "eSewa hasn't confirmed your payment yet. If money has left your eSewa account, don't pay again — we will confirm by email as soon as eSewa does, or call us with your booking number.",
      failedTitle: "Payment not completed",
      failedLede: "The payment was cancelled or didn't go through, so no money was taken and no room was booked.",
      tryAgain: "Try again",
      badTitle: "We couldn't confirm this payment",
      badLede: "Please call or WhatsApp us with the details of your payment, and we'll sort it out.",
      noneTitle: "No booking to show",
      noneLede: "This page shows a booking after paying with eSewa.",
      book: "Book a room",
      home: "Back to the website",
      ref: "Booking number",
      room: "Room", dates: "Dates", guests: "Guests", breakfast: "Breakfast", paid: "Paid", esewa: "eSewa reference",
      yes: "Included", no: "Not included",
      nights: n => n === 1 ? "1 night" : n + " nights",
      wa: "Send to the hotel on WhatsApp",
      waText: (b, lines) => "Hello Hotel Perfect Plaza, I have booked online.\n\n" + lines + "\n\nPlease confirm. Thank you.",
      keep: "Keep your booking number. To change or cancel, call or WhatsApp us with it."
    },
    ne: {
      paidTitle: "तपाईंको कोठा बुक भयो",
      paidLede: b => "धन्यवाद, " + b.name + "। तपाईंको भुक्तानी सफल भयो र कोठा पक्का भयो। पुष्टि इमेल " + b.email + " मा पठाइँदैछ।",
      conflictTitle: "भुक्तानी प्राप्त भयो",
      conflictLede: b => "धन्यवाद, " + b.name + "। तपाईंको भुक्तानी हामीकहाँ आइपुग्यो, तर हामीले कोठा राख्ने २० मिनेटभन्दा बढी समय लाग्यो र यी मितिका कोठा भरिए। हाम्रो रिसेप्सनले छिट्टै " + b.phone + " मा फोन गरी कोठाको व्यवस्था वा पूरै रकम फिर्ता गर्नेछ।",
      pendingTitle: "भुक्तानी जाँच्दै…",
      pendingLede: "eSewa ले अझै भुक्तानी पुष्टि गर्दैछ। यो पेज आफैँ अपडेट हुनेछ।",
      slowTitle: "eSewa को पुष्टि पर्खँदै",
      slowLede: "eSewa ले अझै भुक्तानी पुष्टि गरेको छैन। तपाईंको eSewa खाताबाट रकम कटिसकेको छ भने फेरि नतिर्नुहोस् — eSewa ले पुष्टि गर्नासाथ हामी इमेल गर्नेछौँ, वा बुकिङ नम्बरसहित फोन गर्नुहोस्।",
      failedTitle: "भुक्तानी पूरा भएन",
      failedLede: "भुक्तानी रद्द भयो वा सफल भएन, त्यसैले कुनै रकम काटिएको छैन र कोठा बुक भएको छैन।",
      tryAgain: "फेरि प्रयास गर्नुहोस्",
      badTitle: "यो भुक्तानी पुष्टि गर्न सकिएन",
      badLede: "भुक्तानीको विवरणसहित फोन वा WhatsApp गर्नुहोस्, हामी मिलाइदिनेछौँ।",
      noneTitle: "देखाउनुपर्ने बुकिङ छैन",
      noneLede: "eSewa बाट भुक्तानी गरेपछि यो पेजमा बुकिङ देखिन्छ।",
      book: "कोठा बुक गर्नुहोस्",
      home: "वेबसाइटमा फर्कनुहोस्",
      ref: "बुकिङ नम्बर",
      room: "कोठा", dates: "मिति", guests: "पाहुना", breakfast: "बिहानको नास्ता", paid: "भुक्तानी", esewa: "eSewa रेफरेन्स",
      yes: "समावेश", no: "समावेश छैन",
      nights: n => n + " रात",
      wa: "होटललाई WhatsApp मा पठाउनुहोस्",
      waText: (b, lines) => "नमस्ते होटल परफेक्ट प्लाजा, मैले अनलाइन बुकिङ गरेको छु।\n\n" + lines + "\n\nकृपया पुष्टि गर्नुहोस्। धन्यवाद।",
      keep: "बुकिङ नम्बर राख्नुहोस्। परिवर्तन वा रद्द गर्न यही नम्बरसहित फोन वा WhatsApp गर्नुहोस्।"
    }
  };
  const t = () => T[lang()] || T.en;
  const npr = n => (lang() === "ne" ? "रु. " : "NPR ") + Number(n).toLocaleString("en-US");
  const day = iso => new Intl.DateTimeFormat(lang() === "ne" ? "ne-NP" : "en-GB",
    { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC", numberingSystem: "latn" }).format(new Date(iso + "T00:00:00Z"));
  const nightsOf = b => Math.round((Date.parse(b.checkOut) - Date.parse(b.checkIn)) / 86400000);

  /* --------------------------------------------------------------- state */
  const params = new URLSearchParams(location.search);
  let state = "loading", booking = null, uuid = null, polls = 0;

  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function render() {
    const tt = t();
    card.textContent = "";
    card.className = "result__card is-" + state;
    const title = el("h1", "result__title"), lede = el("p", "result__lede");
    card.append(title, lede);

    if (state === "loading" || state === "pending") {
      card.prepend(el("span", "book__spinner"));
      title.textContent = tt.pendingTitle; lede.textContent = tt.pendingLede;
    } else if (state === "slow") {
      title.textContent = tt.slowTitle; lede.textContent = tt.slowLede;
    } else if (state === "paid" || state === "conflict") {
      card.prepend(el("span", "result__tick", "✓"));
      title.textContent = state === "paid" ? tt.paidTitle : tt.conflictTitle;
      lede.textContent = state === "paid" ? tt.paidLede(booking) : tt.conflictLede(booking);
    } else if (state === "failed") {
      title.textContent = tt.failedTitle; lede.textContent = tt.failedLede;
    } else if (state === "bad") {
      title.textContent = tt.badTitle; lede.textContent = tt.badLede;
    } else {
      title.textContent = tt.noneTitle; lede.textContent = tt.noneLede;
    }

    if (booking && state !== "failed") {
      const rows = details();
      const dl = el("dl", "result__details");
      rows.forEach(([k, v]) => { const d = el("div"); d.append(el("dt", null, k), el("dd", null, v)); dl.append(d); });
      card.append(dl);
    }

    const actions = el("div", "result__actions");
    if ((state === "paid" || state === "conflict" || state === "slow") && booking) {
      const wa = el("a", "btn result__wa");
      wa.innerHTML = '<svg aria-hidden="true"><use href="#i-whatsapp"/></svg>';
      wa.append(tt.wa);
      const text = tt.waText(booking, details().map(([k, v]) => k + ": " + v).join("\n"));
      wa.href = window.HPP && window.HPP.waLink ? window.HPP.waLink(text) : "https://wa.me/9779854022215?text=" + encodeURIComponent(text);
      wa.target = "_blank"; wa.rel = "noopener";
      actions.append(wa);
      card.append(el("p", "result__keep", tt.keep));
    }
    if (state === "failed" || state === "none") actions.append(Object.assign(el("a", "btn", state === "failed" ? tt.tryAgain : tt.book), { href: "./?book=1" }));
    actions.append(Object.assign(el("a", "result__home", tt.home), { href: "./" }));
    card.append(actions);
    document.title = title.textContent + " — Hotel Perfect Plaza";
  }

  function details() {
    const tt = t(), b = booking, n = nightsOf(b);
    const roomName = (lang() === "ne" && NE[b.roomName]) || b.roomName;
    return [
      [tt.ref, b.id],
      [tt.room, (b.rooms > 1 ? b.rooms + " × " : "") + roomName],
      [tt.dates, day(b.checkIn) + " – " + day(b.checkOut) + " (" + tt.nights(n) + ")"],
      [tt.guests, String(b.guests)],
      [tt.breakfast, b.breakfast ? tt.yes : tt.no],
      [tt.paid, npr(b.amount)],
      ...(b.esewaRef ? [[tt.esewa, b.esewaRef]] : [])
    ];
  }

  /* -------------------------------------------------------------- talking */
  async function verify(query) {
    let res, json;
    try {
      res = await fetch("/api/esewa-verify?" + new URLSearchParams(query), { headers: { Accept: "application/json" } });
      json = await res.json();
    } catch (e) { json = null; }
    if (json && json.booking) booking = json.booking;
    if (res && (res.status === 400 || res.status === 404)) { state = "bad"; return render(); }
    if (!json || !json.state || json.state === "pending") {
      state = polls < 24 ? "pending" : "slow";
      render();
      if (polls++ < 24) setTimeout(() => verify({ t: uuid }), 5000);
      return;
    }
    state = json.state;
    render();
    if (state === "paid" || state === "conflict") { try { sessionStorage.removeItem("hpp-booking"); } catch (e) {} }
  }

  /* ---------------------------------------------------------------- start */
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem("hpp-booking") || "null"); } catch (e) {}

  if (params.get("failed")) {
    /* eSewa may tack "?data=…" onto the address: keep only the id */
    const t0 = params.get("failed").split("?")[0];
    fetch("/api/esewa-failed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: t0 }) }).catch(() => {});
    state = "failed"; render();
  } else if (params.get("data")) {
    try { uuid = JSON.parse(atob(params.get("data"))).transaction_uuid; } catch (e) { uuid = null; }
    render();
    verify({ data: params.get("data") });
  } else if (saved && saved.t) {
    uuid = saved.t;
    render();
    verify({ t: uuid });
  } else {
    state = "none"; render();
  }

  document.addEventListener("hpp:lang", render);
})();
