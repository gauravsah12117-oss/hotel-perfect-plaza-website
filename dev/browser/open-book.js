/* extract.js, but with the booking dialog's hidden steps shown first */
(async () => {
  await new Promise(r => setTimeout(r, 1200));
  document.querySelectorAll("[data-booking] [hidden]").forEach(e => e.hidden = false);
  return "ok";
})()
