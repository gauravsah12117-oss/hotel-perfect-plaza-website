/* ==========================================================================
   Hotel Perfect Plaza — interface
   --------------------------------------------------------------------------
   The tabs, the scroll reveal, and the nav link that tracks the section in
   view. Booking, contact details and the mobile menu live in main.js; this
   file only adds polish, and the page is complete without it.
   ========================================================================== */

(function () {
  "use strict";

  const root = document.documentElement;
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* The tabs only appear once this line runs — see .tablist in site.css. */
  root.classList.add("ui-ready");

  /* ------------------------------------------------------------ tabs
     WAI-ARIA tabs: one tab in the tab order at a time, arrow keys and
     Home/End move between them, and each panel is labelled by its tab. */

  $$("[data-tabs]").forEach(box => {
    const tabs = $$('[role="tab"]', box);
    const panels = tabs.map(t => document.getElementById(t.getAttribute("aria-controls")));
    if (!tabs.length || panels.some(p => !p)) return;

    const select = (i, moveFocus) => {
      tabs.forEach((tab, j) => {
        const on = i === j;
        tab.setAttribute("aria-selected", String(on));
        tab.tabIndex = on ? 0 : -1;
        panels[j].hidden = !on;
      });
      if (moveFocus) tabs[i].focus();
    };

    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => select(i, false));
      tab.addEventListener("keydown", e => {
        const last = tabs.length - 1;
        const next = { ArrowRight: i === last ? 0 : i + 1,
                       ArrowLeft:  i === 0 ? last : i - 1,
                       Home: 0, End: last }[e.key];
        if (next === undefined) return;
        e.preventDefault();
        select(next, true);
      });
    });

    /* findIndex gives -1 when nothing is marked; fall back to the first */
    const marked = tabs.findIndex(t => t.getAttribute("aria-selected") === "true");
    select(marked < 0 ? 0 : marked, false);
  });

  /* Links that open a tab as well as going to it: "Rooms" in the menu
     shows the hero's rooms, and the hero's restaurant and front-desk cards
     open those tabs in the facilities section. main.js does the scrolling. */
  document.addEventListener("click", e => {
    const link = e.target.closest("[data-show-tab]");
    const tab = link && document.getElementById(link.dataset.showTab);
    if (tab && tab.getAttribute("aria-selected") !== "true") tab.click();
  });

  /* ------------------------------------------------------- card rows
     The arrows beside each row of hero cards move it on by one card. They
     only appear while the row is wider than the frame, and each greys out
     at its end. A hidden row measures nothing; the ResizeObserver catches
     it as its tab opens. */

  $$("[data-deck-track]").forEach(track => {
    const nav = track.parentElement.querySelector("[data-deck-nav]");
    if (!nav) return;
    const [back, on] = $$("[data-deck-step]", nav);

    const sync = () => {
      const max = track.scrollWidth - track.clientWidth;
      nav.hidden = max <= 2;
      back.disabled = track.scrollLeft <= 2;
      on.disabled = track.scrollLeft >= max - 2;
    };

    [back, on].forEach(btn => btn.addEventListener("click", () => {
      const card = track.firstElementChild;
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      const by = card ? card.getBoundingClientRect().width + gap : track.clientWidth * 0.8;
      track.scrollBy({ left: by * Number(btn.dataset.deckStep), behavior: calm ? "auto" : "smooth" });
    }));

    track.addEventListener("scroll", sync, { passive: true });
    if ("ResizeObserver" in window) new ResizeObserver(sync).observe(track);
    else window.addEventListener("resize", sync);
    sync();
  });

  /* ----------------------------------------------------------- reveal
     Elements hide only once this script has confirmed it can bring them
     back (.js on <html>). Nothing above the fold is marked data-reveal, so
     adding the class never hides something the reader is already looking
     at. */

  const items = $$("[data-reveal]");
  if (items.length && "IntersectionObserver" in window && !calm) {
    /* stagger siblings: each one a little after the one before it */
    const seen = new Map();
    items.forEach(el => {
      const n = seen.get(el.parentElement) || 0;
      el.style.setProperty("--d", (n * 0.09).toFixed(2) + "s");
      seen.set(el.parentElement, n + 1);
    });

    root.classList.add("js");

    /* Threshold 0: start on first contact. A ratio threshold scales with the
       element's height, so a tall panel (the feature, the enquiry form) had
       to be well into view before it even began to fade in. */
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0 });

    items.forEach(el => io.observe(el));
  }

  /* ------------------------------------------------------ active link
     The nav link for whichever section holds the middle of the screen.
     The rooms row sits inside the hero, so both can hold it at once: the
     one later in the page wins, and when the row moves off, Home is back. */

  const links = $$(".navlink");
  const targets = links
    .map(a => ({ a, sec: document.querySelector(a.getAttribute("href")) }))
    .filter(x => x.sec);

  if (targets.length && "IntersectionObserver" in window) {
    const inBand = new Set();
    const spy = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) inBand.add(entry.target);
        else inBand.delete(entry.target);
      });
      const current = targets.filter(t => inBand.has(t.sec)).pop();
      if (!current) return;               /* between tracked sections: keep the last */
      targets.forEach(({ a, sec }) => {
        if (sec === current.sec) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    targets.forEach(({ sec }) => spy.observe(sec));
  }
})();
