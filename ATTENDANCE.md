# Staff attendance

The fingerprint machine at the staff entrance sends every punch to the website the moment it
happens. The website keeps it, works out the day, and the owner's phone pops up a
**notification**: *"✅ Hari Yadav came in at 9:22 AM · Kitchen · 22 min late"*.

Everything is in one private app: **https://www.hotelperfectplaza.com/attendance.html**, which
installs on a phone's home screen as **हाजिरी**. Password: `ATTENDANCE_PASSWORD` in Vercel.
The **नेपाली / English** button at the top switches the whole app's language on that phone
(each phone remembers its own); the words are in `assets/js/attendance-ne.js`.

| Section | What's there |
|---|---|
| **Today** | Who came, who is in the hotel now, who is late, who hasn't come, overtime; a timeline per person across the day. Refreshes itself every 30 seconds; ‹ › for other days |
| **Month** | The register (P / L / A / leave / holiday per person per day), then per person: days present, half days, absent, leave, times and minutes late, hours, overtime, overtime pay, unpaid days and the month's pay. Tap a name for every day. **Download for Excel** and **Print** |
| **Punches** | Every punch exactly as the machine recorded it. Add a punch someone forgot ("by hand", always marked). "Leave out" a wrong punch |
| **Staff** | Name, job, phone, shift, weekly day off, joining date, salary, overtime rate, notifications on/off, still working here |
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

### The fingerprint machine

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
- **Pay** (whole months only) = salary − unpaid days × (salary ÷ 30) + overtime pay. Unpaid days
  are absences, unpaid leave, half of each half day, and days before the joining date. Paid
  leave, sick leave, weekly days off and holidays are paid. Days still to come aren't counted, so
  in the middle of the month it's "the pay if the rest of the month is worked".
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
| `api/iclock.js` | Where the machine sends punches (`/iclock/…`, see `vercel.json`) |
| `api/telegram.js` | The bot: adding phones, `/today`, `/now` |
| `api/attendance-cron.js` | The 9 pm summary (`vercel.json` → `crons`) |
| `api/_lib/attendance.js` | The tables, and how days, lateness, overtime and pay are worked out |
| `api/_lib/att-text.js` | The words of every message, English and Nepali. Improve the Nepali here |
| `api/_lib/telegram.js` | Sending to Telegram |
| `api/_lib/push.js`, `api/_lib/notify.js` | The app's own notifications, and sending every message to both |
| `attendance.webmanifest`, `attendance-sw.js` | What makes the page an app: its icon and name, working offline, showing notifications |
| `attendance-bridge/` | Only for a machine without HTTPS (see above) |
| `dev/fake-machine.mjs`, `dev/tests/attendance.test.mjs` | A pretend machine, and the tests (`npm test`) |
