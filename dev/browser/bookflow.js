(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const until = async (fn, ms = 6000) => { for (let i = 0; i < ms / 100; i++) { if (fn()) return true; await wait(100); } return false; };
  await wait(1200);
  const out = [], box = document.querySelector("[data-booking]");
  let captured = null;
  HTMLFormElement.prototype.submit = function () { captured = { action: this.action, fields: Object.fromEntries(new FormData(this)) }; };
  const day = n => new Date(Date.now() + n * 86400000 + 345 * 60000).toISOString().slice(0, 10);
  const set = (sel, v) => { const el = box.querySelector(sel); el.value = v; el.dispatchEvent(new Event("change", { bubbles: true })); el.dispatchEvent(new Event("input", { bubbles: true })); };

  /* 1. a room card opens the dialog with that room asked for */
  document.querySelector('[data-room="Family Suite — king and twin beds"]').click();
  await wait(300);
  out.push("opened from the suite card: " + box.open + "; status: " + box.querySelector("[data-book-status]").textContent);
  set("#b-in", day(20)); set("#b-out", day(22)); set("#b-guests", "3");
  await until(() => box.querySelectorAll(".broom").length === 6);
  const picked = box.querySelector(".broom.is-picked .broom__name");
  out.push("rooms listed: " + box.querySelectorAll(".broom").length + "; pre-selected: " + (picked && picked.textContent) + "; status: " + box.querySelector("[data-book-status]").textContent);
  out.push("each: " + [...box.querySelectorAll(".broom")].map(b => b.querySelector(".broom__name").textContent + " " + b.querySelector(".broom__price strong").textContent + " [" + b.querySelector(".broom__left").textContent + "]").join(" | "));
  out.push("total: " + box.querySelector("[data-book-total]").textContent);
  const bf = box.querySelector(".broom__bf input"); bf.click(); await wait(100);
  out.push("with breakfast: " + box.querySelector("[data-book-total]").textContent + "  (expect 2 × (5,500 + 2,200) = 15,400)");

  /* 2. details, with the errors first */
  box.querySelector('[data-step="1"] button[type=submit]').click(); await wait(200);
  out.push("step 2 shown: " + !box.querySelector('[data-step="2"]').hidden + "; summary: " + box.querySelector("[data-book-summary]").textContent + "; button: " + box.querySelector("[data-book-pay]").textContent);
  box.querySelector("[data-book-pay]").click(); await wait(200);
  out.push("empty form errors: " + [...box.querySelectorAll('[data-step="2"] .field__err:not([hidden])')].length);
  box.querySelector("#b-name").value = "Sita Sharma";
  box.querySelector("#b-email").value = "sita@example.com";
  box.querySelector("#b-phone").value = "9800000000";
  box.querySelector("#b-accept").checked = true;
  out.push("test-mode note shown: " + !box.querySelector("[data-book-test]").hidden);
  box.querySelector("[data-book-pay]").click();
  await until(() => captured);
  out.push("to eSewa: " + (captured ? captured.action + " total=" + captured.fields.total_amount + " uuid=" + captured.fields.transaction_uuid + " success=" + captured.fields.success_url + " failure=" + captured.fields.failure_url : "NOTHING SENT; status: " + box.querySelector("[data-book-status2]").textContent));
  out.push("step 3 shown: " + !box.querySelector('[data-step="3"]').hidden + " — " + box.querySelector("[data-book-going]").textContent);
  window.__captured = captured;
  return "RESULT\n  " + out.join("\n  ") + "\nFIELDS" + JSON.stringify(captured);
})()
