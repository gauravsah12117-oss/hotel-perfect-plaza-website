/* ==========================================================================
   Hotel Perfect Plaza — Janakpurdham, Nepal
   --------------------------------------------------------------------------
   Everything you need to change lives in SITE_CONFIG, directly below.
   Nothing else in this file needs editing.
   ========================================================================== */

const SITE_CONFIG = {

  /* WhatsApp number: country code first, digits only.
     Nepal is 977, so a mobile 98XXXXXXXX becomes "97798XXXXXXXX".
     This is the first mobile on the letterhead — if WhatsApp is on the
     other one (9844022215), change it to "9779844022215". */
  whatsapp: "9779854022215",

  /* The landline — shown on the page and used by every Call button. */
  phone: "+977-41-590911",

  /* The mobiles, listed under "Mobile" in the contact section and footer.
     Digits only, as many as you like. */
  mobiles: ["9854022215", "9844022215"],

  /* Leave empty to hide the email row entirely. */
  email: "hotelperfectplaza@gmail.com",

  /* From formspree.io — create a form, copy the ID out of the endpoint URL.
     Example endpoint https://formspree.io/f/xyzabcde  →  "xyzabcde"
     While this is empty, the form politely hands guests to WhatsApp instead. */
  formspreeId: "",

  /* Paste the "Embed a map" iframe src from Google Maps.
     Leave empty and the map panel shows a hint instead. */
  mapEmbed: "",

  /* The plain "open in Maps" link. Better still: find the hotel on Google
     Maps, press Share, and paste that link here — it opens on the exact pin. */
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Hotel+Perfect+Plaza%2C+Ramanand+Chowk%2C+Janakpurdham",

  address: {
    street: "Ramanand Chowk-9",
    city: "Janakpurdham",
    region: "Madhesh Province",
    postalCode: "45600",
    country: "NP"
  },

  checkIn:  "From 14:00",
  checkOut: "By 12:00",

  /* Add your own, e.g. { facebook: "https://...", instagram: "https://..." } */
  social: {}
};

/* ========================================================================== */

window.HPP = (function () {
  "use strict";

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------ contact details */

  const waDigits = String(SITE_CONFIG.whatsapp || "").replace(/\D/g, "");
  const telHref  = "tel:" + String(SITE_CONFIG.phone || "").replace(/[^\d+]/g, "");

  const waLink = text =>
    "https://wa.me/" + waDigits + (text ? "?text=" + encodeURIComponent(text) : "");

  function wireContacts() {
    $$("[data-tel]").forEach(el => { el.href = telHref; });

    $$("[data-whatsapp]").forEach(el => {
      el.href = waLink("Hello, I would like to ask about a room at Hotel Perfect Plaza.");
      el.target = "_blank";
      el.rel = "noopener";
    });

    $$("[data-phone-display]").forEach(el => { el.textContent = SITE_CONFIG.phone; });

    /* the WhatsApp number as a guest would type it: 98XXXXXXXX */
    $$("[data-whatsapp-display]").forEach(el => { el.textContent = waDigits.replace(/^977/, ""); });

    /* each mobile as its own tap-to-call link, separated by a dot */
    const mobiles = (SITE_CONFIG.mobiles || []).map(m => String(m).replace(/\D/g, "")).filter(Boolean);
    $$("[data-mobiles]").forEach(el => {
      if (!mobiles.length) { const row = el.closest("li, p"); if (row) row.remove(); return; }
      el.textContent = "";
      mobiles.forEach((m, i) => {
        if (i) el.append(" · ");
        const a = document.createElement("a");
        a.href = "tel:+977" + m;
        a.textContent = m;
        el.append(a);
      });
    });

    if (SITE_CONFIG.email) {
      $$("[data-email]").forEach(el => { el.href = "mailto:" + SITE_CONFIG.email; });
      $$("[data-email-display]").forEach(el => { el.textContent = SITE_CONFIG.email; });
    } else {
      $$("[data-email]").forEach(el => { const li = el.closest("li"); if (li) li.remove(); });
    }

    $$("[data-maps]").forEach(el => {
      el.href = SITE_CONFIG.mapsUrl || "#";
      el.target = "_blank";
      el.rel = "noopener";
    });

    $$("[data-checkin]").forEach(el => { el.textContent = SITE_CONFIG.checkIn; });
    $$("[data-checkout]").forEach(el => { el.textContent = SITE_CONFIG.checkOut; });
    const yr = $("[data-year]");
    if (yr) yr.textContent = new Date().getFullYear();
  }

  function wireMap() {
    const holder = $("[data-map]");
    if (!holder || !SITE_CONFIG.mapEmbed) return;
    const frame = document.createElement("iframe");
    frame.src = SITE_CONFIG.mapEmbed;
    frame.loading = "lazy";
    frame.title = "Hotel Perfect Plaza on the map";
    frame.referrerPolicy = "no-referrer-when-downgrade";
    frame.allowFullscreen = true;
    holder.textContent = "";
    holder.appendChild(frame);
  }

  /* ------------------------------------------------- missing-photo fallback
     Until the photographs arrive, any image that fails to load is replaced
     by a gold line lotus on a lit ground (.has-ph in site.css), so nothing
     ever looks broken.                                                     */

  function guardImages() {
    const missing = [];

    const fail = img => {
      if (img.dataset.failed) return;
      img.dataset.failed = "1";
      const holder = img.closest(".frame__media");
      if (holder) holder.classList.add("has-ph");
      missing.push(img.getAttribute("src"));
    };

    $$("img[data-img]").forEach(img => {
      img.addEventListener("error", () => fail(img));
      if (img.complete && img.naturalWidth === 0) fail(img);
    });

    window.addEventListener("load", () => {
      if (missing.length) {
        console.info(
          "Hotel Perfect Plaza — %d photo(s) not found yet. Drop them into " +
          "assets/images/ using these exact names (see CONTENT-TODO.md):\n  %s",
          missing.length, missing.join("\n  ")
        );
      }
    });
  }

  /* ------------------------------------------------------ masthead & drawer */

  function wireMasthead() {
    const bar = $("[data-masthead]");
    const actionbar = $("[data-actionbar]");
    const hero = $(".hero");
    const avail = $("[data-avail]");
    if (!bar) return;

    const onScroll = () => {
      bar.classList.toggle("is-stuck", window.scrollY > 30);
      if (actionbar && hero) {
        /* The phone's bar rises once the hero's own availability bar has
           gone off the top: its "Book now" takes over from that one. */
        const gone = avail ? avail.getBoundingClientRect().bottom < 0
                           : window.scrollY > hero.offsetHeight * 0.7;
        actionbar.classList.toggle("is-up", gone);
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  function wireDrawer() {
    const burger = $("[data-burger]"), drawer = $("[data-drawer]");
    if (!burger || !drawer) return;

    const setOpen = open => {
      burger.setAttribute("aria-expanded", String(open));
      drawer.hidden = !open;
      document.body.style.overflow = open ? "hidden" : "";
      burger.querySelector(".sr-only").textContent = open ? "Close menu" : "Open menu";
    };

    burger.addEventListener("click", () =>
      setOpen(burger.getAttribute("aria-expanded") !== "true"));
    drawer.addEventListener("click", e => { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && !drawer.hidden) { setOpen(false); burger.focus(); }
    });
  }

  /* ---------------------------------------------------------- section jumps
     Links to a part of this page — "View rooms", "Book now", the menu, the
     footer — scroll there without writing "#rooms" into the address bar.
     The address a guest copies or shares is then always the plain one, and
     the plain one always opens on the hero (see the note at the top of
     index.html). Each jump is still a step in the browser's history, so the
     phone's Back button returns to where the guest was, as before. The page
     keeps that position itself, in the history entry, because the browser's
     own remembering is switched off by that note.                         */

  const noteJump = section => {
    try {
      history.replaceState(Object.assign({}, history.state, { hppY: window.scrollY }), "");
      history.pushState({ hppSection: section }, "");
    } catch (e) { /* history refused (a page opened from disk): the jump still happens */ }
  };

  function wireSectionLinks() {
    document.addEventListener("click", e => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target.closest('a[href^="#"]');
      if (!link) return;
      const target = document.getElementById(decodeURIComponent(link.getAttribute("href").slice(1)));
      if (!target) return;                        /* nowhere to go: leave it to the browser */
      e.preventDefault();
      noteJump(target.id);
      target.scrollIntoView({ block: "start" });  /* smooth unless the guest asked for less motion: the CSS decides */
      /* take keyboard and screen-reader users there too, as a real jump does */
      if (!target.hasAttribute("tabindex")) {
        target.setAttribute("tabindex", "-1");
        target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
      }
      target.focus({ preventScroll: true });
    });

    /* Back and Forward: straight back to where the guest was, as the
       browser itself would. */
    window.addEventListener("popstate", e => {
      const s = e.state || {};
      const el = s.hppSection && document.getElementById(s.hppSection);
      if (typeof s.hppY === "number") window.scrollTo({ top: s.hppY, behavior: "instant" });
      else if (el) el.scrollIntoView({ block: "start", behavior: "instant" });
      else window.scrollTo({ top: 0, behavior: "instant" });
    });
  }

  /* ------------------------------------------------------------ date fields
     Formatted from local parts, never toISOString(): Nepal is UTC+5:45, so
     converting to UTC rolls the date back a day.                          */

  const isoLocal = d => {
    const p = v => String(v).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  };
  const today = () => isoLocal(new Date());
  const addDays = (iso, n) => {
    const d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + n);
    return isoLocal(d);
  };

  function linkDates(inEl, outEl) {
    if (!inEl || !outEl) return;
    inEl.min = today();
    outEl.min = addDays(today(), 1);
    inEl.addEventListener("change", () => {
      if (!inEl.value) return;
      outEl.min = addDays(inEl.value, 1);
      if (outEl.value && outEl.value <= inEl.value) outEl.value = addDays(inEl.value, 1);
    });
  }

  /* --------------------------------------------------- sending to the hotel
     The enquiry form sends through here. With a Formspree ID it is emailed; without
     one, WhatsApp opens with the message written out. WhatsApp must open
     inside the click itself or the browser blocks the new tab, so that branch
     runs before anything is awaited. Resolves to "email" or "whatsapp";
     rejects if the email could not be sent.                               */

  function sendToHotel(fields, subject, text) {
    if (!SITE_CONFIG.formspreeId) {
      window.open(waLink(text), "_blank", "noopener");
      return Promise.resolve("whatsapp");
    }
    const body = new FormData();
    Object.keys(fields).forEach(k => body.append(k, fields[k] == null ? "" : String(fields[k])));
    body.append("_subject", subject);
    if (fields.email) body.append("_replyto", fields.email);
    return fetch("https://formspree.io/f/" + SITE_CONFIG.formspreeId, {
      method: "POST", headers: { Accept: "application/json" }, body
    }).then(res => {
      if (!res.ok) throw new Error("Formspree replied " + res.status);
      return "email";
    });
  }

  /* ------------------------------------------ availability bar → the form
     The bar in the hero carries its dates and guests down into the enquiry
     form; every "Check availability" / "Enquire about…" link marked
     data-room also picks the matching option in the form's Room list.    */

  function wireAvailability() {
    const form = $("[data-form]"), target = $("#enquire");
    if (!form || !target) return;

    const fIn = $("#f-in"), fOut = $("#f-out"), fGuests = $("#f-guests"),
          fRoom = $("#f-room"), fName = $("[data-focus]", form);
    linkDates(fIn, fOut);

    const handOff = () => {
      noteJump(target.id);                        /* so Back returns, as for any section link */
      target.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
      window.setTimeout(() => {
        const first = [fName, fIn, fOut].find(el => el && !el.value);
        (first || fName || form).focus({ preventScroll: true });
      }, calm ? 0 : 700);
    };

    const bar = $("[data-avail]");
    if (bar) {
      const aIn = $("[data-avail-in]"), aOut = $("[data-avail-out]"), aGuests = $("[data-avail-guests]");
      linkDates(aIn, aOut);
      bar.addEventListener("submit", e => {
        e.preventDefault();
        if (aIn && aIn.value && fIn) fIn.value = aIn.value;
        if (aOut && aOut.value && fOut) fOut.value = aOut.value;
        if (aGuests && aGuests.value && fGuests) fGuests.value = aGuests.value;
        handOff();
      });
    }

    $$("[data-room]").forEach(link => {
      link.addEventListener("click", e => {
        e.preventDefault();
        const wanted = link.dataset.room;
        if (fRoom && wanted) {
          const match = Array.from(fRoom.options).find(o => o.value === wanted || o.text === wanted);
          if (match) fRoom.value = match.value;
        }
        handOff();
      });
    });
  }

  /* ------------------------------------------------------- the enquiry form */

  function wireForm() {
    const form = $("[data-form]");
    if (!form) return;
    const status = $("[data-status]", form), submit = $("[data-submit]", form);

    const setErr = (id, bad) => {
      const field = $("#" + id), note = $('[data-err="' + id + '"]', form);
      if (field && field.parentElement) field.parentElement.classList.toggle("is-bad", bad);
      if (note) note.hidden = !bad;
    };

    const validate = () => {
      const dIn = $("#f-in"), dOut = $("#f-out");
      const bad = {
        "f-name":  !$("#f-name").value.trim(),
        "f-email": !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test($("#f-email").value.trim()),
        "f-in":    !!dIn && !dIn.value,
        "f-out":   !!dOut && (!dOut.value || (dIn.value && dOut.value <= dIn.value))
      };
      Object.keys(bad).forEach(id => setErr(id, bad[id]));
      const firstBad = Object.keys(bad).find(id => bad[id]);
      if (firstBad) $("#" + firstBad).focus();
      return !firstBad;
    };

    const summarise = d =>
      "Hello Hotel Perfect Plaza,\n\nI would like to ask about a stay.\n\n" +
      "Name: " + d.name + "\nCheck-in: " + d.arriving + "\nCheck-out: " + d.leaving +
      "\nGuests: " + d.guests + "\nRoom: " + d.room +
      (d.message ? "\n\n" + d.message : "") +
      "\n\nEmail: " + d.email + (d.phone ? "\nPhone: " + d.phone : "");

    form.addEventListener("submit", e => {
      e.preventDefault();
      status.className = "form__status";
      status.textContent = "";

      if ($('[name="_gotcha"]', form).value) return;     /* a bot filled the trap */
      if (!validate()) {
        status.classList.add("is-bad");
        status.textContent = "Check the highlighted fields and send again.";
        return;
      }

      const data = Object.fromEntries(new FormData(form).entries());
      delete data._gotcha;
      const text = summarise(data);
      const label = submit.textContent;
      if (SITE_CONFIG.formspreeId) { submit.disabled = true; submit.textContent = "Sending…"; }

      sendToHotel(data, "Enquiry: " + data.room + " — " + data.name, text)
        .then(via => {
          status.classList.add("is-ok");
          if (via === "whatsapp") {
            status.textContent = "WhatsApp has opened with your enquiry written out — press Send there and it reaches us.";
          } else {
            form.reset();
            status.textContent = "Thank you — your enquiry is with us. We usually reply within a few hours.";
          }
        })
        .catch(err => {
          console.error(err);
          status.classList.add("is-bad");
          status.innerHTML = 'That did not send. Please <a class="link" href="' +
            waLink(text) + '" target="_blank" rel="noopener">message us on WhatsApp</a> instead.';
        })
        .finally(() => { submit.disabled = false; submit.textContent = label; });
    });
  }

  /* -------------------------------------------------------------- lightbox */

  /* The gallery's photo viewer: tap a picture to see it large; arrows, a
     swipe on a phone, or the arrow keys move along; Escape, the ✕ or a tap
     on the dark surround closes it. The caption is the picture's own alt
     text, so it is translated along with the page. */
  function wireLightbox() {
    const box = $("[data-lightbox]"), shots = $$("[data-track] .shot");
    if (!box || !shots.length || typeof box.showModal !== "function") return;

    const img = $("[data-lb-img]", box), cap = $("[data-lb-cap]", box),
          count = $("[data-lb-count]", box), figure = $(".lightbox__figure", box);
    const pic = i => $("img", shots[(i + shots.length) % shots.length]);
    let at = 0;

    const show = i => {
      at = (i + shots.length) % shots.length;
      const src = pic(at);
      img.src = src.src;                /* the file itself, loaded or not yet */
      img.alt = src.alt;
      cap.textContent = src.alt;
      if (count) count.textContent = (at + 1) + " / " + shots.length;
      /* fetch the neighbours now, so the next swipe is instant */
      [at - 1, at + 1].forEach(n => { const p = new Image(); p.src = pic(n).src; });
    };

    shots.forEach((shot, i) => shot.addEventListener("click", () => {
      show(i);
      document.documentElement.classList.add("lb-open");
      box.showModal();
    }));

    /* Unlock the page and hand focus back to the photo on show. Run straight
       away by our own close buttons: the dialog's "close" event, which also
       covers Escape, can arrive a second late while photos are loading. */
    const done = () => {
      if (!document.documentElement.classList.contains("lb-open")) return;
      document.documentElement.classList.remove("lb-open");
      shots[at].focus({ preventScroll: true });
    };
    const shut = () => { box.close(); done(); };

    $("[data-lb-prev]", box).addEventListener("click", () => show(at - 1));
    $("[data-lb-next]", box).addEventListener("click", () => show(at + 1));
    $("[data-lb-close]", box).addEventListener("click", shut);
    box.addEventListener("keydown", e => {
      if (e.key === "ArrowLeft")  { e.preventDefault(); show(at - 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); show(at + 1); }
    });
    /* a tap on the dark surround (not the picture, not a button) closes */
    box.addEventListener("click", e => { if (e.target === box || e.target === figure) shut(); });

    /* swipe left / right on a phone; a mostly-vertical move is left alone */
    let x0 = null, y0 = 0;
    box.addEventListener("touchstart", e => {
      if (e.touches.length !== 1) { x0 = null; return; }
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
    }, { passive: true });
    box.addEventListener("touchend", e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) show(at + (dx < 0 ? 1 : -1));
    }, { passive: true });

    box.addEventListener("close", done);
  }

  /* ------------------------------------------------- search-engine listing */

  function wireSchema() {
    const slot = $("[data-schema]");
    if (!slot) return;
    const a = SITE_CONFIG.address;
    slot.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Hotel",
      name: "Hotel Perfect Plaza",
      description: "A hotel at Ramanand Chowk, Janakpurdham, Nepal, ten minutes' walk from the Janaki Mandir.",
      url: window.location.origin + window.location.pathname,
      image: new URL("assets/images/og-image.jpg", window.location.href).href,
      telephone: SITE_CONFIG.phone,
      email: SITE_CONFIG.email || undefined,
      address: {
        "@type": "PostalAddress",
        streetAddress: a.street, addressLocality: a.city, addressRegion: a.region,
        postalCode: a.postalCode, addressCountry: a.country
      },
      checkinTime: SITE_CONFIG.checkIn,
      checkoutTime: SITE_CONFIG.checkOut,
      sameAs: Object.values(SITE_CONFIG.social).filter(Boolean),
      amenityFeature: ["Air conditioning", "Free Wi-Fi", "Restaurant", "Room service",
                       "Airport shuttle", "24-hour front desk", "Laundry service"]
        .map(n => ({ "@type": "LocationFeatureSpecification", name: n, value: true }))
    });
  }

  /* ----------------------------------------------------------------- start */

  wireContacts();
  wireMap();
  guardImages();
  wireMasthead();
  wireDrawer();
  wireSectionLinks();
  wireAvailability();
  wireForm();
  wireLightbox();
  wireSchema();

  document.body.classList.remove("is-loading");

  /* Exposed for any add-on script; nothing on the page reads it today. */
  return {
    config: SITE_CONFIG, calm, $, $$,
    waLink, sendToHotel, isoLocal, today, addDays, linkDates
  };
})();
