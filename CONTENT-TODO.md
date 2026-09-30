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

## 5. Lord Ram & Mata Sita — out of the hero for now

**At your request the picture has been taken out of the hero**, which now shows the hotel's own
lobby, colour-graded, with glass panels for the stay details and the booking bar. The file
(`assets/images/ram-sita.jpg`) and its script (`assets/js/hero-figure.js`) are kept, so it can
come back whenever you say — the notes below still apply when it does.

It was **frame 2** of your 12-frame sheet, Ram and Sita facing forward, as a still
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

## 6. Photographs of the hotel — done, from the set on your desktop

I went through `C:\Users\hotel\Desktop\hotel photo` and placed these on the page, resized and
compressed for the web (each auto-rotated, exact `width`/`height` and `alt` text updated to
match what's actually in each photo):

| Site file | Made from | Used for |
|---|---|---|
| `hotel-lobby.jpg` | `Front view.JPG` | "About the hotel" — see below |
| `front-desk.jpg` | `DSC_7061.JPG` | The reception desk, in Restaurant, events and services |
| `room-1.jpg` | `deluxe room.JPG` | Deluxe Room |
| `room-2.jpg` | `DSC_6972.JPG` | Executive Room |
| `room-3.jpg` | `Glass view room.JPG` | Plaza Suite |
| `og-image.jpg` | `Front main view.JPG`, cropped to 1200 × 630 | What appears when the link is shared |

**No exterior photo was in that folder** — every photo is indoors. The "About the hotel" section
therefore now shows the **lobby**, not the front of the building (the `<img>` was renamed from
`hotel-exterior.jpg` to `hotel-lobby.jpg` and its alt text says "reception and lobby," not
"front," so nothing on the page overclaims). If you'd like the actual building front there
instead, send me a daylight photo of the entrance and I'll swap it in — same spot, one file.

**Still needed, because the folder had none:**
- `dining-room.jpg` — the restaurant, laid and lit. (The restaurant's own signage is visible in
  the lobby photos, but that's not the same as a photo of the dining room itself.)
- `banquet.jpg` — the hall or lawn set up for a function. *Only if section 1 is confirmed.*

**Photos I didn't use, still in your folder, available if you want a gallery per room later:**
`room view.JPG`, `Double bed room.JPG` and `Bed view.JPG` (more angles of the two room types
above), `DSC_7000.JPG` (a third angle of the Deluxe Room), and `Elevator View.JPG` (the
lift/staircase corridor). The current room cards show one photo each; say the word and I'll add
a click-to-enlarge gallery so guests can flick through all of a room's photos.

**The real logo** (`hotellogo.tif`) is now used everywhere a mark appears: the header, the
footer, and the phone/tablet home-screen icon (`assets/favicon/apple-touch-icon.png`, already
wired in). In the header and footer it sits on its own small white card
(`assets/images/hotel-logo.png`), which is why it stays legible over the dark hero, over the
white header once the page scrolls, and on the dark footer — a plain image would disappear
against the hero's colours, especially the black "HOTEL"/"PLAZA" text.

**One real limitation:** the source file is only 600 × 288 px, so the logo is a little soft up
close (most visible on the footer, where it's shown largest). If you have a bigger version — the
original design file, or whatever was used to print your signage or letterhead — send it and
I'll swap it in; everything else about the layout stays the same.

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
- [x] The site's address — `canonical`/`og:url` in `index.html`, `sitemap.xml` and `robots.txt`
      — points at `https://hotel-perfect-plaza-website.vercel.app/`. Once you have a real domain,
      tell me and I'll swap all four in one go (and it's a five-minute add in Vercel's dashboard)
- [x] iPhone/Android home-screen icon — `assets/favicon/apple-touch-icon.png`, made from your
      real logo (see section 6 for the one caveat on its sharpness)
- [ ] Send one test enquiry and confirm it lands
- [ ] Open the site on a real phone and press Call and WhatsApp
- [ ] Look through the whole page on a real phone: Lord Ram and Mata Sita appear in the hero,
      the booking bar sits under them, and nothing stutters while you scroll
- [ ] If you added the hero film, watch it on a real phone for a minute: it plays, the loop is
      smooth, and Ram is not cut off
