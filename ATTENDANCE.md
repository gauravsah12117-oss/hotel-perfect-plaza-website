# Staff attendance

The fingerprint machine at the staff entrance sends every punch to the website the moment it
happens. The website keeps it, works out the day, and the owner's phone pops up a
**notification**: *"✅ Hari Yadav came in at 9:22 AM · Kitchen · 22 min late"*.

Everything is in one private app: **https://www.hotelperfectplaza.com/attendance.html**, which
installs on a phone's home screen as **हाजिरी**. Password: `ATTENDANCE_PASSWORD` in Vercel.
The **नेपाली / English** button at the top switches the whole app's language on that phone
(each phone remembers its own); the words are in `assets/js/attendance-ne.js`.
The **वि.सं. / AD** button switches every date between the Nepali calendar (Bikram Sambat) and
the English one. With Nepali dates, **Month** picks a Nepali month (e.g. कात्तिक 2083) and
works out the register and the pay for exactly that month; each date box in a form shows the
Nepali date under it; the Excel download always has both dates; the 9 pm summary shows both.

**The Nepali calendar's table** is in `assets/js/nepali-date.js` (BS 2075–2090). 2075–2083
were checked day by day against four independent calendar libraries. **2084 onwards are the
best available projection**: each year, when the official calendar for the next year is
published (Nepal Panchanga Nirnayak Samiti, usually around Chaitra), compare its month lengths
with that year's row and correct the row if they differ.

| Section | What's there |
|---|---|
| **Today** | Who came, who is in the hotel now, who is late, who hasn't come, overtime; a timeline per person across the day. Refreshes itself every 30 seconds; ‹ › for other days |
| **Month** | The register (P / L / A / leave / holiday per person per day), then per person: days present, half days, absent, leave, times and minutes late, hours, overtime, overtime pay, unpaid days, additions, deductions and the month's net pay. Tap a name for every day. **Payslip** per person (with the salary advances, bonuses, allowances, tax and other deductions of that month), **Print all payslips**, **Download for Excel**, **Print** |
| **Punches** | Every punch exactly as the machine recorded it. Add a punch someone forgot ("by hand", always marked). "Leave out" a wrong punch |
| **Staff** | The **weekly roster** (who works Morning, Day, Evening, Night or has a day off, each day; "Copy last week"), then name, job, phone, usual shift, weekly day off, joining date, salary, overtime rate, SSF, notifications on/off, still working here |
| **Leave** | Paid, sick and unpaid leave per person; holidays for everyone (Dashain, Tihar…) |
| **Settings** | Notifications on this phone, installing the app, the fingerprint machines, the hotel's rules (usual shift, late after, overtime from, overtime rate, language of the notifications), backup, Telegram (optional) |

**Notifications**
- When someone arrives (on time, or how late), leaves (hours worked, overtime, left early), or
  comes back from a break; in English or Nepali (Settings)
- At about 9 pm, the day's summary: present, late, absent, on leave, still in, overtime,
  forgotten punch-outs, and a warning if the machine has gone offline
- If the machine loses its internet, it keeps its punches and sends them when it's back. They
  come as one notification ("the machine was offline…") rather than twenty

**Safety**
- Signing in swaps the password for a *sign-in pass* that the phone keeps (400 days); the
  password itself is never stored. A new `ATTENDANCE_PASSWORD` in Vercel signs every phone out.
- Five wrong passwords from one place in 15 minutes lock it out for 15 minutes.
- The app's pages can't be shown inside another website, and only load the hotel's own files.
- Only a fingerprint machine approved in Settings can add punches.

**Backup**: Settings → *Backup* → **Download backup** saves every record (staff, leave,
holidays, settings and a year's punches) as a file. Do it every few months and keep the file
safe.

---

## Setting it up (once)

Done already (November 2026): the password, `CRON_SECRET` (the 9 pm summary), the notification
keys (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`), the domain. Don't change the
`VAPID_` keys: every phone would have to turn notifications on again. To change the password:
Vercel → the project → Settings → Environment Variables → `ATTENDANCE_PASSWORD` → Edit, then
Deployments → ⋯ → **Redeploy**.

### Your father's phone

1. Open **www.hotelperfectplaza.com/attendance.html** and sign in, with *Keep me signed in on
   this phone* ticked.
2. Put it on the home screen. **Android** (Chrome): Settings → **Install the app on this
   device**, or Chrome's **⋮** menu → **Add to Home screen** → **Install**.
   **iPhone** (Safari): **Share** → **Add to Home Screen** → **Add**.
3. Open **हाजिरी** from the home screen → **Settings → Notifications on this phone → Turn on
   notifications** → **Allow**. Type a name ("Father's phone"). Press **Send a test**.

- **Android:** if notifications stop, check that Chrome and हाजिरी are allowed notifications in
  the phone's settings, and not limited by battery saver.
- **iPhone:** only from the app on the home screen, on iOS 16.4 or newer.
- Each phone turns them on for itself. **Remove** in that list stops a phone.

**Telegram (optional):** the same messages can also go to Telegram. Create a bot with
@BotFather, add its token in Vercel as `TELEGRAM_BOT_TOKEN`, redeploy, then Settings → Telegram
→ **Add a phone**. Not needed while the app's notifications work.

### The fingerprint machine: Hikvision (the hotel's, from MeroHajir)

Hikvision terminals (DS-K1T320, DS-K1T342, DS-K1T343 and the like) send each punch to the
website through **HTTP Listening**. No new machine is needed.

1. The terminal on the hotel's internet: a LAN cable to the router (or Wi-Fi on Wi-Fi models).
2. On a computer on the hotel's network, open the terminal's IP address in a browser (the
   terminal shows it under Communication → Network) and sign in as **admin**, or use iVMS-4200 →
   Device Management → the terminal → Remote Configuration.
3. **Configuration → Network → Network Service → HTTP Listening** (some firmware calls it
   *Event Alarm* or *Alarm Server*): IP address / domain **`www.hotelperfectplaza.com`**,
   URL **`/api/hik`**, port **443**, protocol **HTTPS**. Save.
4. Punch once. Within a minute the terminal shows in **Settings → Fingerprint machines** as
   **HIK-** and its MAC address. **Approve** it, then punch again: punches before approval are not
   kept (unlike ZKTeco machines, Hikvision doesn't send them again).
5. Each person's **Employee No.** on the terminal is their **Machine no.** in Staff.
6. Time: Configuration → System → Time Settings → **(GMT+05:45) Kathmandu**, NTP on.

MeroHajir's own connection to the terminal can stay until you stop their service. If the terminal
has no HTTPS option in HTTP Listening, use the bridge (below) with the terminal's URL set to
`/api/hik` and the bridge computer's address and port 8081.

**First real punches:** this was built from Hikvision's published event format and tested with
sample events; the first punches from the hotel's terminal are the real test. If they don't
arrive, the terminal still appears in Settings (with its model in the details), which tells us
what it sent.

### The fingerprint machine: ZKTeco or eSSL

The system speaks ZKTeco's **ADMS / "Cloud Server"** protocol. Most ZKTeco and eSSL machines sold
in Nepal have it: K40, K50, MB160, MB20, iClock, uFace, SpeedFace, and eSSL's X990 and
Magnum, among others. Ask the shop for *"ADMS / Push / Cloud Server"* support, and if possible
**HTTPS** support.

1. Connect the machine to the internet: a LAN cable to the hotel's router (most reliable), or
   Wi-Fi on models that have it.
2. On the machine: **Menu → Comm. → Cloud Server Setting** (on some models *ADMS*).
3. **Enable Domain Name**: on. **Server address**: `www.hotelperfectplaza.com`, with the www.
   The machine doesn't follow redirects, so the address without www won't do.
4. **HTTPS**: on, **Server port**: `443`. **Proxy**: off. Save, then restart the machine.
5. Within a minute it shows in **Settings → Fingerprint machines** as *Waiting for approval*.
   Press **Approve**. From then on every punch arrives, including the ones already stored in the
   machine (the old ones are kept without sending messages).
6. Check the machine's date and time (**Menu → System → Date Time**). Every time shown comes
   from the machine's clock. If the clock runs fast, Today warns you.

**Machine without HTTPS?** Some older machines only speak plain `http://`, and the website only
answers on `https://`. Then use the small *bridge* in `attendance-bridge/` on any computer at the
hotel. Install Node.js (nodejs.org, LTS), double-click `start-bridge.bat`, and on the machine set
the server address to that computer's IP address (the bridge shows it), port **8081**, HTTPS off,
domain name off. That computer must stay on. If it's off, punches wait in the machine and arrive
later. A cheaper long-term fix is a machine with HTTPS.

### The staff

1. Enrol each person's finger on the machine as usual. The machine gives each person a **user
   number** (1, 2, 3…).
2. In **Staff**, add each person with **the same number** as "Machine no.", their name, job,
   shift (empty = the usual hours in Settings), weekly day off, joining date and monthly salary.
   If someone punches before being added, they appear as *Staff #7*. Fill in their name then. A
   name typed on the machine itself is picked up automatically.
3. Night staff: give the real shift, e.g. 20:00 to 08:00. The whole night counts as one day, the
   day it started.
4. Someone who leaves the job: untick **Still working here** in Staff. Their history stays.

---

## How the numbers are worked out

- **A day** starts 4 hours before the person's shift (a 9 am shift's day runs 5 am to 5 am).
  The first punch is arriving, the last is leaving. A punch between them is going out (a break)
  and the next one coming back. Breaks aren't counted as worked. Two presses within 2 minutes
  count as one.
- **Late**: arriving more than *Late after* minutes (default 10) after the shift starts. 9:10 is
  on time, 9:11 is 11 minutes late. **Left early** works the same way at the end of the shift.
- **Half day**: worked less than half the shift.
- **Overtime**: hours worked beyond the shift length, counted only once it reaches *Overtime
  counts from* (default 30 minutes). On a weekly day off or a holiday, everything worked is
  overtime.
- **Overtime pay per hour**: the person's own rate if set in Staff. Otherwise salary ÷ 30 ÷
  shift hours × the overtime rate (default 1.5).
- **The roster**: a day's shift is the one chosen in the weekly roster, otherwise the person's
  usual one. A day's punches run from 4 hours before its shift to 4 hours before the next day's,
  but never end sooner than an hour after the shift does, so a night shift's 6 am punch-out stays
  with that night even when a morning shift follows.
- **Pay / the payslip** (whole months only):
  - *Basic salary* = salary − unpaid days × (salary ÷ 30). Unpaid days are absences, unpaid
    leave, half of each half day, and days before the joining date. Paid leave, sick leave,
    weekly days off and holidays are paid. Days still to come aren't counted, so in the middle
    of the month it's "the pay if the rest of the month is worked".
  - *Earnings* = basic salary + overtime pay + bonuses + allowances.
  - *Deductions* = SSF (for staff ticked "In the SSF": 11% of the basic salary, Settings) +
    salary advances + tax + other deductions. The hotel's own SSF share (20%) is shown on the
    payslip, not taken from pay.
  - *Net pay* = earnings − deductions.
  - Advances, bonuses, allowances, tax and deductions are added on the payslip with a date; they
    count in the month that date falls in (Nepali month with Nepali dates on). Tax is entered as
    an amount: work it out with the accountant.
- **Forgot to punch out**: the day shows *No punch out*. Its hours aren't counted until a punch
  is added by hand in **Punches**.
- **A wrong punch**: **Leave out** in Punches. Nothing the machine sends is ever deleted.

The report runs on English (AD) dates. For a Nepali month (e.g. Kartik), set **From** and **To**
to its first and last day.

---

## Good to know

- **Cost**: nothing extra. It uses the website's existing Vercel and Neon database; the
  notifications are free and unlimited.
- **Privacy**: the app isn't linked from the website and is hidden from search engines. Only a
  machine you approved can add punches, and only phones that turned notifications on in the
  signed-in app get them.
- **Notifications need**: the machine online (its internet) and at least one phone that turned
  them on. Today lists anything still missing under *Still to set up*.
- **The domain** `hotelperfectplaza.com` is paid until 3 October 2029 at Hostinger: turn on
  auto-renew. If it lapses, the app and the machine stop with the website.
- **9 pm summary**: Vercel's free plan runs it some time between 9:00 and 10:00 pm.
- **Trying it without a machine**: on this computer, `npm run dev`, then in another window
  `node dev/fake-machine.mjs` (connect), approve it in Settings, then `node dev/fake-machine.mjs demo`
  (a week of punches) or `node dev/fake-machine.mjs 5` (staff no. 5 punches now). Password: `test`.

### Files

| File | Does |
|---|---|
| `attendance.html`, `assets/js/attendance.js`, `assets/css/attendance.css` | The page |
| `api/attendance.js` | The page's data (needs `ATTENDANCE_PASSWORD`) |
| `api/iclock.js` | Where a ZKTeco / eSSL machine sends punches (`/iclock/…`, see `vercel.json`) |
| `api/hik.js` | Where a Hikvision terminal sends punches (`/api/hik`, HTTP Listening) |
| `api/telegram.js` | The bot: adding phones, `/today`, `/now` |
| `api/attendance-cron.js` | The 9 pm summary (`vercel.json` → `crons`) |
| `api/_lib/attendance.js` | The tables, and how days, lateness, overtime and pay are worked out |
| `api/_lib/att-text.js` | The words of every message, English and Nepali. Improve the Nepali here |
| `api/_lib/telegram.js` | Sending to Telegram |
| `api/_lib/push.js`, `api/_lib/notify.js` | The app's own notifications, and sending every message to both |
| `attendance.webmanifest`, `attendance-sw.js` | What makes the page an app: its icon and name, working offline, showing notifications |
| `attendance-bridge/` | Only for a machine without HTTPS (see above) |
| `dev/fake-machine.mjs`, `dev/tests/attendance.test.mjs` | A pretend machine, and the tests (`npm test`) |
