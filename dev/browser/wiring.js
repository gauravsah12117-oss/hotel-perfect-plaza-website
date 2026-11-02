/* How the booking dialog fits the rest of the page. */
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(1200);
  const out = [], box = document.querySelector("[data-booking]");
  const close = async () => { if (box.open) box.close(); await wait(150); };
  document.documentElement.style.scrollBehavior = "auto";

  document.querySelector(".masthead__book").click(); await wait(200);
  out.push("header Book now opens the dialog: " + box.open + " (page scroll at " + Math.round(scrollY) + ")"); await close();
  out.push("focus back on Book now after closing: " + document.activeElement.classList.contains("masthead__book"));

  const day = n => new Date(Date.now() + n * 86400000 + 345 * 60000).toISOString().slice(0, 10);
  document.querySelector("[data-avail-in]").value = day(3); document.querySelector("[data-avail-out]").value = day(4); document.querySelector("[data-avail-guests]").value = 1;
  document.querySelector("[data-avail]").requestSubmit(); await wait(1200);
  out.push("hero bar → dialog with its dates: " + box.open + " " + box.querySelector("#b-in").value + "→" + box.querySelector("#b-out").value + " guests " + box.querySelector("#b-guests").value + "; rooms listed " + box.querySelectorAll(".broom").length); await close();

  document.querySelector('a[data-room="Wedding or banquet"]').click(); await wait(300);
  out.push("wedding link → enquiry form, not the dialog: dialog open=" + box.open + ", form room=" + document.querySelector("#f-room").value);

  document.querySelector('[data-room="Not sure yet"]').click(); await wait(1200);
  out.push("rates card → dialog, no room forced: " + box.open + ", picked=" + (box.querySelector(".broom.is-picked") ? "yes" : "none")); await close();

  /* ids, labels */
  const ids = [...document.querySelectorAll("[id]")].map(e => e.id);
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  const unl = [...document.querySelectorAll("input:not([type=hidden]), select, textarea")].filter(i => !i.closest("[data-booking] [data-book-rooms]") && !document.querySelector('label[for="' + i.id + '"]') && !i.closest("label"));
  out.push("duplicate ids: " + (dup.join(", ") || "none") + "; controls without a label: " + (unl.map(i => i.id || i.name).join(", ") || "none"));
  return "RESULT\n  " + out.join("\n  ");
})()
