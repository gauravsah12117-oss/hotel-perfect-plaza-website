/* ==========================================================================
   Hotel Perfect Plaza — English ⇄ नेपाली
   --------------------------------------------------------------------------
   The page is written in English; NE (in i18n-ne.js) gives the Nepali for
   each piece of English text, matched exactly (runs of spaces count as one).
   The header button swaps the text in place — words, picture descriptions,
   button labels, the page title — and back again, without reloading. The
   choice is remembered on that phone or computer. A phone set to Nepali
   starts in Nepali.

   To change a translation: edit the Nepali (right-hand) side in i18n-ne.js.
   New English text on the page with no entry there simply stays English —
   add a line for it. An element that needs different Nepali in one place
   can carry its own, as data-ne="…" (used where one English phrase reads
   differently in two spots).

   Text the hotel's scripts write later (form messages, the check-in times)
   is translated as it appears, by watching the page for changes.
   ========================================================================== */

(function () {
  "use strict";

  const NE = window.HPP_NE || {};
  const KEY = "hpp-lang";
  const html = document.documentElement;
  const ATTRS = ["alt", "aria-label", "title", "placeholder"];
  const SKIP = "script, style, noscript, svg, [translate='no']";
  const norm = s => s.replace(/\s+/g, " ").trim();

  const textEn = new WeakMap();      /* text node → its English */
  const attrEn = new WeakMap();      /* element → { attribute: its English } */
  const titleEn = document.title;
  let lang = "en";

  const nepali = (en, el) => {
    if (el && el.hasAttribute("data-ne")) return el.getAttribute("data-ne");
    return NE[norm(en)];
  };
  const wrap = (en, t) => en.match(/^\s*/)[0] + t + en.match(/\s*$/)[0];

  function doText(node) {
    const el = node.parentElement;
    if (!el || el.closest(SKIP)) return;
    const en = textEn.has(node) ? textEn.get(node) : node.nodeValue;
    if (!norm(en)) return;
    if (lang === "ne") {
      const t = nepali(en, el);
      if (t === undefined) return;
      textEn.set(node, en);
      const next = wrap(en, t);
      if (node.nodeValue !== next) node.nodeValue = next;
    } else if (textEn.has(node) && node.nodeValue !== en) {
      node.nodeValue = en;
    }
  }

  function doAttrs(el) {
    if (el.closest(SKIP)) return;
    const saved = attrEn.get(el) || {};
    ATTRS.forEach(a => {
      if (!(a in saved) && !el.hasAttribute(a)) return;
      const en = a in saved ? saved[a] : el.getAttribute(a);
      if (lang === "ne") {
        const t = NE[norm(en || "")];
        if (t === undefined) return;
        saved[a] = en; attrEn.set(el, saved);
        if (el.getAttribute(a) !== t) el.setAttribute(a, t);
      } else if (a in saved && el.getAttribute(a) !== en) {
        el.setAttribute(a, en);
      }
    });
  }

  function walk(root) {
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1 || root.closest(SKIP)) return;
    doAttrs(root);
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.nodeType === 1 && n.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    let n = tw.nextNode();
    while (n) { if (n.nodeType === 3) doText(n); else doAttrs(n); n = tw.nextNode(); }
  }

  /* ------------------------------------------------------------ the button */

  const sw = document.querySelector("[data-lang-switch]");
  const label = sw && sw.querySelector("[data-lang-label]");
  function setButton() {
    if (!sw || !label) return;
    if (lang === "ne") {
      label.textContent = "English"; label.lang = "en";
      sw.setAttribute("aria-label", "English — अंग्रेजीमा पढ्नुहोस्");
      sw.title = "Read this page in English";
    } else {
      label.textContent = "नेपाली"; label.lang = "ne";
      sw.setAttribute("aria-label", "Read in Nepali — नेपालीमा पढ्नुहोस्");
      sw.title = "यो पेज नेपालीमा पढ्नुहोस्";
    }
  }

  /* Devanagari text face, fetched only when someone reads in Nepali */
  function loadFont() {
    if (document.querySelector("link[data-deva-font]")) return;
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.setAttribute("data-deva-font", "");
    l.href = "https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600&display=swap";
    document.head.appendChild(l);
  }

  function apply(next, remember) {
    lang = next;
    html.lang = next;
    if (next === "ne") loadFont();
    walk(document.body);
    document.title = next === "ne" ? (NE[norm(titleEn)] || titleEn) : titleEn;
    setButton();
    if (remember) { try { localStorage.setItem(KEY, next); } catch (e) { /* private mode */ } }
    html.classList.remove("lang-pending");
  }

  if (sw) sw.addEventListener("click", () => apply(lang === "ne" ? "en" : "ne", true));

  /* Text written later — by main.js, by the photo viewer — is translated as
     it arrives. Our own changes come back through here too, and are left
     alone because they already read as they should. */
  new MutationObserver(records => {
    if (lang !== "ne") return;
    records.forEach(r => {
      if (r.type === "childList") r.addedNodes.forEach(walk);
      else if (r.type === "characterData") {
        const node = r.target;
        if (textEn.has(node)) {
          const en = textEn.get(node), t = nepali(en, node.parentElement);
          if (t === undefined || node.nodeValue !== wrap(en, t)) textEn.delete(node);   /* new English */
        }
        doText(node);
      } else if (r.type === "attributes") doAttrs(r.target);
    });
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });

  /* ------------------------------------------------------------- start */

  let start = null;
  try { start = localStorage.getItem(KEY); } catch (e) { /* private mode */ }
  if (start !== "ne" && start !== "en") start = /^ne\b/i.test(navigator.language || "") ? "ne" : "en";
  if (start === "ne") apply("ne", false);
  else { setButton(); html.classList.remove("lang-pending"); }

  /* for testing, and any later script */
  window.HPP_I18N = { set: l => apply(l, true), get: () => lang };
})();
