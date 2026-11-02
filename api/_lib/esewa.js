/* ==========================================================================
   eSewa ePay (v2): the signed form that sends a guest to pay, and checking
   that a payment really happened.
   --------------------------------------------------------------------------
   https://developer.esewa.com.np/pages/Epay

   ESEWA_MODE=test (the default) uses eSewa's test system: product code
   EPAYTEST and eSewa's published test key. No real money moves; pay with
   test eSewa ID 9711111111, password Nepal@123, MPIN 1122, token 123456.

   ESEWA_MODE=live needs the hotel's own merchant code and secret key from
   eSewa, in ESEWA_PRODUCT_CODE and ESEWA_SECRET. The secret never leaves
   the server.
   ========================================================================== */

import { createHmac, timingSafeEqual } from "node:crypto";

const TEST = {
  form: "https://rc-epay.esewa.com.np/api/epay/main/v2/form",
  status: "https://rc.esewa.com.np/api/epay/transaction/status/",
  productCode: "EPAYTEST",
  secret: "8gBm/:&EnhH.1/q"
};
const LIVE = {
  form: "https://epay.esewa.com.np/api/epay/main/v2/form",
  status: "https://esewa.com.np/api/epay/transaction/status/"
};

export function config() {
  if ((process.env.ESEWA_MODE || "test") !== "live") return { mode: "test", ...TEST };
  const productCode = process.env.ESEWA_PRODUCT_CODE, secret = process.env.ESEWA_SECRET;
  if (!productCode || !secret) throw Object.assign(new Error("ESEWA_MODE=live needs ESEWA_PRODUCT_CODE and ESEWA_SECRET"), { code: "NO_ESEWA" });
  return { mode: "live", ...LIVE, productCode, secret };
}

/* base64(HMAC-SHA256(secret, "name=value,name=value,...")) over the named fields, in order */
export function sign(fields, names, secret) {
  const message = names.map(n => n + "=" + fields[n]).join(",");
  return createHmac("sha256", secret).update(message).digest("base64");
}

/* The fields of the form the guest's browser posts to eSewa. Amounts are
   whole rupees; this hotel charges no tax or service on top in eSewa's own
   fields (any VAT or service charge is already inside the total). */
export function paymentForm({ total, uuid, successUrl, failureUrl }) {
  const c = config();
  const fields = {
    amount: String(total),
    tax_amount: "0",
    total_amount: String(total),
    transaction_uuid: uuid,
    product_code: c.productCode,
    product_service_charge: "0",
    product_delivery_charge: "0",
    success_url: successUrl,
    failure_url: failureUrl,
    signed_field_names: "total_amount,transaction_uuid,product_code"
  };
  fields.signature = sign(fields, fields.signed_field_names.split(","), c.secret);
  return { action: c.form, fields, mode: c.mode };
}

/* eSewa's redirect after a payment carries ?data=<base64 JSON>. Returns the
   decoded object if its signature is genuine, else null. */
export function readSuccessData(data) {
  let obj;
  try { obj = JSON.parse(Buffer.from(String(data || ""), "base64").toString("utf8")); } catch { return null; }
  if (!obj || typeof obj !== "object" || typeof obj.signed_field_names !== "string" || typeof obj.signature !== "string") return null;
  const names = obj.signed_field_names.split(",");
  if (!names.includes("transaction_uuid") || !names.includes("total_amount")) return null;
  const expected = Buffer.from(sign(obj, names, config().secret));
  const given = Buffer.from(obj.signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return obj;
}

/* "1,000.0" → 1000 */
export const rupees = v => Math.round(Number(String(v).replace(/,/g, "")));

/* Asks eSewa itself whether the payment went through. Returns
   { status: "COMPLETE" | "PENDING" | ..., ref } or { status: "ERROR" }. */
export async function checkStatus({ uuid, total }, fetchImpl = fetch) {
  const c = config();
  const url = c.status + "?" + new URLSearchParams({ product_code: c.productCode, total_amount: String(total), transaction_uuid: uuid });
  try {
    const res = await fetchImpl(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
    const body = await res.json();
    if (!body || !body.status) return { status: "ERROR", detail: body };
    if (body.transaction_uuid !== uuid || rupees(body.total_amount) !== Number(total)) return { status: "MISMATCH", detail: body };
    return { status: body.status, ref: body.ref_id || null };
  } catch (e) {
    return { status: "ERROR", detail: String(e && e.message || e) };
  }
}
