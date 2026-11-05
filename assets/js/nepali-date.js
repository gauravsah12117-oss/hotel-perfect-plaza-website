/* ==========================================================================
   Bikram Sambat (वि.सं.), the Nepali calendar: English (AD) dates to Nepali
   (BS) dates and back. Used by attendance.html (the वि.सं. / AD button) and by
   the server (the Nepali date in the 9 pm summary).
   --------------------------------------------------------------------------
   The Nepali calendar has no formula: each month's length is fixed every
   year by the Nepal Panchanga Nirnayak Samiti. DAYS below is that table.
   2075–2083 agree exactly in four independent calendar libraries
   (nepali-date-converter, nepali-datetime, bikram-sambat,
   @sbmdkl/nepali-date-converter), checked day by day in November 2026.
   2084–2090: three of the four agree; check them against the official
   calendar when it is published and correct a row here if it differs.
   Outside 2075–2090 the app shows English dates.
   ========================================================================== */

(function (root) {
  "use strict";
  const FIRST = 2075, FIRST_AD = Date.UTC(2018, 3, 14);      /* 2075 Baisakh 1 = 14 April 2018 */
  const DAYS = [
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],   /* 2075 */
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],   /* 2076 */
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],   /* 2077 */
    [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],   /* 2078 */
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],   /* 2079 */
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],   /* 2080 */
    [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],   /* 2081 */
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],   /* 2082 */
    [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],   /* 2083 */
    [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30],   /* 2084 */
    [31, 32, 31, 32, 30, 31, 30, 30, 29, 30, 30, 30],   /* 2085 */
    [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],   /* 2086 */
    [31, 31, 32, 31, 31, 31, 30, 30, 29, 30, 30, 30],   /* 2087 */
    [30, 31, 32, 32, 30, 31, 30, 30, 29, 30, 30, 30],   /* 2088 */
    [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],   /* 2089 */
    [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30]    /* 2090 */
  ];
  const MONTHS = ["Baisakh", "Jestha", "Asar", "Shrawan", "Bhadra", "Asoj", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"];
  const MONTHS_NE = ["बैशाख", "जेठ", "असार", "साउन", "भदौ", "असोज", "कात्तिक", "मंसिर", "पुस", "माघ", "फागुन", "चैत"];
  const DAY = 86400000;
  const sum = a => a.reduce((x, y) => x + y, 0);

  /* "2026-11-05" → { y: 2083, m: 7, d: 19 } (m 1–12), or null outside the table */
  function toBS(iso) {
    const t = Date.parse(String(iso).slice(0, 10) + "T00:00:00Z");
    if (isNaN(t)) return null;
    let n = Math.round((t - FIRST_AD) / DAY);
    if (n < 0) return null;
    for (let i = 0; i < DAYS.length; i++) {
      for (let j = 0; j < 12; j++) {
        if (n < DAYS[i][j]) return { y: FIRST + i, m: j + 1, d: n + 1 };
        n -= DAYS[i][j];
      }
    }
    return null;
  }

  /* (2083, 7, 19) → "2026-11-05", or null */
  function toAD(y, m, d) {
    const i = y - FIRST;
    if (!DAYS[i] || m < 1 || m > 12 || d < 1 || d > DAYS[i][m - 1]) return null;
    let n = d - 1;
    for (let k = 0; k < i; k++) n += sum(DAYS[k]);
    for (let k = 0; k < m - 1; k++) n += DAYS[i][k];
    return new Date(FIRST_AD + n * DAY).toISOString().slice(0, 10);
  }

  const daysIn = (y, m) => (DAYS[y - FIRST] || [])[m - 1] || 0;
  const years = () => [FIRST, FIRST + DAYS.length - 1];

  root.NepaliDate = { toBS, toAD, daysIn, years, MONTHS, MONTHS_NE };
})(typeof window !== "undefined" ? window : globalThis);
