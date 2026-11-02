/* Opens the booking dialog with dates, a room and breakfast picked; with
   window.__step = 2, goes on to the details step. For screenshots. */
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(800);
  const day = n => new Date(Date.now() + n * 86400000 + 345 * 60000).toISOString().slice(0, 10);
  window.HPP_BOOK.open({ checkIn: day(7), checkOut: day(9), guests: 3, room: "Superior Room — AC, triple bed" });
  const box = document.querySelector("[data-booking]");
  for (let i = 0; i < 60 && box.querySelectorAll(".broom").length < 6; i++) await wait(100);
  await wait(200);
  const bf = box.querySelector(".broom__bf input"); if (bf) bf.click();
  await wait(200);
  if (window.__step === 2) {
    box.querySelector('[data-step="1"] button[type=submit]').click(); await wait(300);
    box.querySelector("#b-name").value = "Sita Sharma"; box.querySelector("#b-email").value = "sita@example.com"; box.querySelector("#b-phone").value = "9800000000";
    box.querySelector("[data-book-pay]").focus();
  }
  const r = box.getBoundingClientRect();
  return "RESULT dialog " + Math.round(r.width) + "x" + Math.round(r.height) + " scrollH=" + box.scrollHeight +
    " pageOverflowX=" + (document.documentElement.scrollWidth > innerWidth) + " total='" + box.querySelector("[data-book-total]").textContent + "'";
})()
