/* Every piece of English text on the page, in page order (for dev/i18n-sync.mjs). */
(async () => {
  await new Promise(r => setTimeout(r, 1500));
  const SKIP = "script, style, noscript, svg, [translate='no'], [data-result]";
  const norm = s => s.replace(/\s+/g, " ").trim();
  const seen = new Set(), out = [];
  const add = s => { s = norm(s || ""); if (!s || seen.has(s) || !/[A-Za-z]/.test(s)) return; seen.add(s); out.push(s); };
  add(document.title);
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: n => n.nodeType === 1 && n.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  let n = tw.nextNode();
  while (n) {
    if (n.nodeType === 3) add(n.nodeValue);
    else ["alt", "aria-label", "title", "placeholder"].forEach(a => { if (n.hasAttribute(a)) add(n.getAttribute(a)); });
    n = tw.nextNode();
  }
  return "RESULT" + JSON.stringify(out);
})()
