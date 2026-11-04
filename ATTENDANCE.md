# Staff attendance

The fingerprint machine at the staff entrance sends every punch to the website the moment it
happens. The website keeps it, works out the day, and sends a **Telegram message** to the
owner's phone: *"✅ Hari Yadav came in at 9:22 AM · Kitchen · 22 min late"*.

Everything is on one private page: **`/attendance.html`**
(**https://www.hotelperfectplaza.com/attendance.html**). It works on a phone too.

| Tab | What's there |
|---|---|
| **Daily** | Who came, when, who is late, who hasn't come, who is in the hotel right now, hours worked, overtime. Today's view refreshes itself every 30 seconds; pick any date to look back |
| **Monthly report** | Per person: days present, half days, absent, leave, days off and holidays, times late and minutes late, hours worked, overtime hours, overtime pay, unpaid days, and the month's pay. Tap a name for every day. **Download for Excel** and **Print** |
| **Punches** | Every punch exactly as the machine recorded it. Add a punch someone forgot ("by hand", always marked). "Leave out" a wrong punch |
| **Staff** | Name, job, phone, shift, weekly day off, joining date, salary, overtime rate, messages on/off, still working here |
| **Leave & holidays** | Paid, sick and unpaid leave per person; holidays for everyone (Dashain, Tihar…) |
| **Settings** | Telegram phones, which messages are sent and in which language (English / नेपाली), the hotel's rules (usual shift, late after, overtime from, overtime rate), the fingerprint machines |

**Messages on Telegram**
- When someone arrives (on time, or how late), leaves (hours worked, overtime, left early), or
  comes back from a break
- At about 9 pm, the day's summary: present, late, absent, on leave, still in, overtime,
  forgotten punch-outs, and a warning if the machine has gone offline
- Send **/today** to the bot at any time for the summary so far, **/now** for who is in the hotel
- If the machine loses its internet, it keeps its punches and sends them when it's back. They
  come as one message ("the machine was offline…") rather than twenty

---

## Setting it up (once)

### 1. A password for the page

Vercel → the project → **Settings → Environment Variables** → add:

| Name | Value |
|---|---|
| `ATTENDANCE_PASSWORD` | A long password only you (and your father) know. **Not** the front desk's `ADMIN_PASSWORD`: this page shows salaries |
| `CRON_SECRET` | Any long random text. Stops anyone else triggering the 9 pm summary |

### 2. The Telegram bot (5 minutes, free)

1. Install Telegram on your phone, open it and search for **@BotFather** (the one with the blue tick).
2. Send it `/newbot`. Give it a name, e.g. *Hotel Perfect Plaza Staff*, and then a username ending
   in `bot`, e.g. *PerfectPlazaStaffBot*.
3. BotFather replies with a **token** like `7412345678:AAH…`. In Vercel add
   `TELEGRAM_BOT_TOKEN` = that token. Keep it private: whoever has it can send as the bot.
4. Redeploy (Vercel → Deployments → ⋯ → **Redeploy**) so steps 1 and 2 take effect.

### 3. Your father's phone

1. Open `/attendance.html` and sign in → **Settings** → **Add a phone**.
2. A link appears. Send it to your father's phone (WhatsApp or Viber is fine). He needs Telegram
   installed. He opens the link and presses **Start**. The bot answers "Connected".
3. Press **Check now**: his name appears in the list. Press **Send a test message**.

Add as many phones as you like (yours, a manager's): each one needs its own new link. **Pause**
stops messages to a phone for a while; **Remove** stops them for good.

### 3½. The app on his phone

The page can also sit on the home screen as an app called **हाजिरी**, with its own icon. It
opens full screen, stays signed in, and keeps itself up to date. There's nothing to download
from the Play Store or App Store. On his phone:

1. Open **www.hotelperfectplaza.com/attendance.html** and sign in, with *Keep me
   signed in on this phone* ticked.
2. **Android** (Chrome): press **Install app** at the top. If it isn't there, open Chrome's
   **⋮** menu → **Add to Home screen** → **Install**.
   **iPhone** (Safari): **Share** → **Add to Home Screen** → **Add**.
3. From then on he taps **हाजिरी** on the home screen. Telegram brings the messages the moment
   someone punches. The app is for the whole day, the month and the register.

*Sign out* on that phone, or a new `ATTENDANCE_PASSWORD` in Vercel, signs the app out.

### 4. The fingerprint machine

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
   from the machine's clock. If the clock runs fast, the Daily tab warns you.

**Machine without HTTPS?** Some older machines only speak plain `http://`, and the website only
answers on `https://`. Then use the small *bridge* in `attendance-bridge/` on any computer at the
hotel. Install Node.js (nodejs.org, LTS), double-click `start-bridge.bat`, and on the machine set
the server address to that computer's IP address (the bridge shows it), port **8081**, HTTPS off,
domain name off. That computer must stay on. If it's off, punches wait in the machine and arrive
later. A cheaper long-term fix is a machine with HTTPS.

### 5. The staff

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

- **Cost**: nothing extra. It uses the website's existing Vercel and Neon database, and Telegram
  is free.
- **Privacy**: the page isn't linked from the website and is hidden from search engines. Only a
  machine you approved can add punches, and only phones that used a one-time link get messages.
- **Messages need**: the machine online (its internet), `TELEGRAM_BOT_TOKEN` set, and at least
  one phone added. The Daily tab lists anything still missing under *Still to set up*.
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
| `attendance-bridge/` | Only for a machine without HTTPS (see above) |
| `dev/fake-machine.mjs`, `dev/tests/attendance.test.mjs` | A pretend machine, and the tests (`npm test`) |
