# What still needs your content

Everything on the site works right now. What follows is placeholder material to replace with
the real thing. Nothing here breaks the page if you leave it — a photograph that has not arrived
shows a small lotus in a plain frame instead of a broken image.

Work top to bottom. **Section 1 matters most for honesty; section 6, your photographs, matters
most for how real the site looks.** Nothing makes a hotel website look genuine like photographs
of the actual hotel.

---

## 1. Check what the page promises — before anything else

The new design asked for a weddings & banquets section and a guest-care section. I wrote them
to sound right, but **I do not know whether the hotel offers these things.** A guest who books
a reception on the strength of this page, and finds there is no hall, is a real problem. Please
confirm or correct each line — in `index.html`, the **Restaurant, events and services** section:

**Weddings & events tab**
- [ ] The hotel hosts **wedding receptions and engagement ceremonies**
- [ ] …**family gatherings and religious functions**
- [ ] …**catering from its own kitchen**, with **vegetarian menus on request**
- [ ] …**rooms held together** for a wedding party
- [ ] How many guests can it seat? The page deliberately gives no number — tell me and I'll add it

**Guest services tab**
- [ ] **Airport pickup** — and is it free or charged?
- [ ] **Guides, rickshaws and cars** arranged for the day
- [ ] **Front desk and room service through the night**
- [ ] **Laundry**, and help with onward travel

If any of these is wrong, tell me which and I will rewrite it — or remove the tab entirely.

**The headline** is your tagline, *For Perfect Satisfaction*. Confirm that is the exact wording.

---

## 2. Your contact details

Open `assets/js/main.js`. Everything is in the `SITE_CONFIG` block at the very top.

| Setting | What to put there |
|---|---|
| `whatsapp` | Country code then number, digits only. A Nepali mobile `9812345678` becomes `"9779812345678"` |
| `phone` | As you want it printed, e.g. `"+977-41-590123"` |
| `email` | Your booking inbox. Leave `""` and the email row disappears |
| `mapsUrl` | Open Google Maps, find the hotel, press Share, copy the link |
| `address` | Street, city, region, postal code |
| `checkIn` / `checkOut` | Your actual times |

**Until `formspreeId` is filled in, the enquiry form opens WhatsApp with the message
pre-written instead of emailing you.** That works, but see section 3.

---

## 3. Turn the enquiry form on

1. Go to [formspree.io](https://formspree.io) and make a free account
2. Create a new form, and point it at your booking email
3. Formspree gives you an endpoint like `https://formspree.io/f/xyzabcde`
4. Copy only the last part — `xyzabcde` — into `formspreeId` in `assets/js/main.js`
5. Send yourself one test enquiry and confirm it arrives

The free tier covers 50 submissions a month.

---

## 4. The Janakpur photographs — done, with credits

The Janakpur section leads with **your picture of the Janaki Mandir lit up at dusk**
(`janaki-mandir.jpg`). If it came from the internet rather than from the hotel, check you have
permission to use it — a hotel website is commercial use.

The three smaller photographs are from Wikimedia Commons: the temple lit in colour at night, a
Mithila painter, and sunset over Ganga Sagar. Their licences allow a hotel to use them
**provided the photographers are credited**, and the credits are printed at the foot of that
section. Leave them in place. If you swap in your own photo, delete its credit.

The earlier request for a painting of Lord Ram and Mata Janaki is no longer needed — the hero
shows them, and the Janakpur section leads with the temple.

---

## 5. Lord Ram & Mata Sita in the hero — a sharper picture

The hero shows **frame 2** of your 12-frame sheet, Ram and Sita facing forward, as a still
picture. The 360° turn has been removed. Each frame on the sheet is a separate AI image — Ram's
dress changes from one to the next — so no rotation built from them could look smooth.

- **It's small.** The picture is only 247 × 362 px, so it is capped at 500 px tall to stay
  sharp. A larger version of the same picture — **at least 1000 × 1500 px**, on the same dark
  `#0B0F19` background, with no caption — would look noticeably crisper. Save it as
  `assets/images/ram-sita.jpg` and update the `width` and `height` on its `<img>` in
  `index.html` to match.
- **Want real movement?** Use the hero film in section 5b: a short looping video of Ram and
  Sita plays behind the headline and takes over from the picture automatically.

---

## 5b. The hero film (optional)

A short looping film of Lord Ram before the Janaki Mandir can play behind the headline. The
site is already built for it: save the file as **`assets/video/ram-hero.mp4`** and it plays by
itself. Until then the picture of Ram and Sita fills the hero, so nothing is waiting on this.

Everything needed to make it — the prompt for an AI video tool, the phone version, sizes, how
to make the file small — is in **[VIDEO-BRIEF.md](VIDEO-BRIEF.md)**.

| File | |
|---|---|
| `assets/video/ram-hero.mp4` | The film, 16:9, 1920 × 1080, 8–10 seconds, no sound, under 6 MB |
| `assets/video/ram-hero-portrait.mp4` | *Optional* — an upright 9:16 version for phones |
| `assets/video/ram-hero-poster.jpg` | *Optional* — one still frame, shown to visitors saving data or asking for less motion |

---

## 6. Photographs of the hotel — the most important item here

These seven frames are still empty, and **they are what will make the site look real**. They
must be photographs of the actual hotel — a guest who books a room from a stock photo and finds
a different room is a complaint waiting to happen. A good phone camera in daylight is enough:
switch on every light, open the curtains, tidy, and shoot from a corner at chest height.

Drop them into `assets/images/` using **exactly these filenames**. Landscape, 1600 px wide or
more, ideally under 400 KB each.

| File | What it should show |
|---|---|
| `hotel-exterior.jpg` | **The front of the hotel**, in daylight — the "About the hotel" section |
| `room-1.jpg` | Deluxe Room |
| `room-2.jpg` | Executive Room |
| `room-3.jpg` | Plaza Suite |
| `dining-room.jpg` | The restaurant, laid and lit |
| `banquet.jpg` | The hall or lawn set up for a function. *Only if section 1 is confirmed* |
| `front-desk.jpg` | The front desk, ideally with a member of staff |

### Sharing

| File | What it should show |
|---|---|
| `og-image.jpg` | What appears when someone shares the link. **1200 × 630** |

**The gallery is gone.** The new design's brief did not include one, so the eight
`gallery-*.jpg` photos from the earlier version are no longer used. If you would like a gallery
back, say so — it is quick to add.

**If you rename anything,** update the matching `src` in `index.html` and its `alt` text with it.
The alt text is what blind visitors and search engines read, so describe the photo rather than
labelling it.

---

## 7. Written details to check

These are placeholders written to sound right. Confirm each against reality.

### Rooms — `index.html`, the Rooms section

- [ ] Room names — currently Deluxe Room, Executive Room, Plaza Suite
- [ ] **Rates** — currently NPR 4,500 / 6,500 / 11,000. **These are invented**
- [ ] Room sizes — currently 26 / 34 / 52 m²
- [ ] Occupancy and bed types
- [ ] The details under each room
- [ ] The **Room** list in the enquiry form uses the same names — keep them matching
- [ ] Is breakfast included in every rate? The page says so

### The four facts under the booking bar

- [ ] "10 minutes' walk to the Janaki Mandir" — is that right from your door?
- [ ] "Open all night" — front desk and room service
- [ ] "Breakfast included in every room rate"
- [ ] "Air-conditioned, with hot water and Wi-Fi"
- [ ] "25 minutes by air from Kathmandu" (under *Getting here*)

### Dining

- [ ] Opening hours — currently 7:00–22:00 for both the dining room and room service
- [ ] The dishes named: river fish in mustard, *bagiya*

### Getting here

- [ ] Road distance and time from Kathmandu — currently 225 km, 7–8 hours
- [ ] The border crossing named is Bhittamod

### Missing entirely — tell me and I'll add them

- [ ] Number of rooms in the hotel
- [ ] Parking
- [ ] Cancellation policy
- [ ] Any awards, star rating, or review scores
- [ ] Social media links (`social` in `SITE_CONFIG`)
- [ ] Guest reviews worth quoting

---

## 8. Before you go live

- [ ] Everything in section 1 confirmed or corrected
- [ ] Replace `hotelperfectplaza.com` with your real domain in `index.html` (the `canonical` and
      `og:url` tags), `sitemap.xml` and `robots.txt`
- [ ] Add an iPhone home-screen icon: save a 180×180 PNG as
      `assets/favicon/apple-touch-icon.png`, then add
      `<link rel="apple-touch-icon" href="assets/favicon/apple-touch-icon.png">`
      to `index.html` just below the existing `<link rel="icon" …>`
- [ ] Send one test enquiry and confirm it lands
- [ ] Open the site on a real phone and press Call and WhatsApp
- [ ] Look through the whole page on a real phone: Lord Ram and Mata Sita appear in the hero,
      the booking bar sits under them, and nothing stutters while you scroll
- [ ] If you added the hero film, watch it on a real phone for a minute: it plays, the loop is
      smooth, and Ram is not cut off
