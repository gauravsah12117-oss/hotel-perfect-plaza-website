# Hotel Perfect Plaza

The website for Hotel Perfect Plaza, Janakpurdham, Nepal — *For Perfect Satisfaction.*

One page, no install, no build step. Double-click `index.html` and it opens.

---

## Editing it

| I want to change… | Open this |
|---|---|
| Phone, WhatsApp, email, address, map, check-in times | `assets/js/main.js` — the `SITE_CONFIG` block at the very top |
| Any words on the page | `index.html` |
| Colours and fonts | `assets/css/site.css` — the `:root` block at the top |
| Photographs | Drop files into `assets/images/` using the existing filenames |

Start with [CONTENT-TODO.md](CONTENT-TODO.md) — it lists everything still to supply, and the
hotel's own photographs matter most.

---

## What's in the folder

| File | Does |
|---|---|
| `index.html` | The page |
| `assets/css/site.css` | The whole look: colours, type, layout, buttons, cards, form states |
| `assets/js/main.js` | Contact details, the booking handoff, the enquiry form, dates, missing-photo fallback |
| `assets/js/ui.js` | The tabs (the hero's cards and the facilities), the card rows' arrows, the scroll reveal, the nav link that follows the section in view |
| `assets/js/i18n.js` | The English ⇄ नेपाली switch in the header |
| `assets/js/i18n-ne.js` | The Nepali text: English on the left, Nepali on the right — edit the right-hand side to improve a translation |
| `assets/js/hero-figure.js` | Fades in Lord Ram & Mata Sita in the hero once the picture has loaded |
| `assets/images/ram-sita.jpg` | That picture (33 KB) — frame 2 of the 12-frame sheet, cut out |
| `assets/images/janaki-mandir.jpg` | The Janaki Mandir lit up at dusk — the hotel's own picture, leading the Janakpur section |
| `assets/images/janaki-mandir-night.jpg`, `mithila-art.jpg`, `ponds.jpg` | Real photographs of Janakpur from Wikimedia Commons — see *Photo credits* below |
| `assets/images/ram-sita-turntable.png` / `.webp` | The original 12-frame sheet, kept as the source. The page does not load it |
| `assets/images/hotel-logo.png` | The real logo, on a white card — used in the header, the footer, and (cropped) as the home-screen icon |
| `assets/js/film.js` | The hero's video loop, the "Watch the hotel tour" player, and the welcome film in "About the hotel" |
| `assets/images/dining-room.jpg`, `restaurant-thali.jpg`, `restaurant-meal.jpg` | The restaurant and two of its meals (a Nepali thali, a set meal) — the hotel's own photographs, shown together in the Restaurant tab |
| `assets/images/banquet.jpg`, `meeting-room.jpg` | Stills from the hotel's promo film (the buffet counter in the dining hall, the meeting room), taken between the film's captions |
| `assets/images/gallery-*.jpg`, `hotel-exterior.jpg`, `dining-hall.jpg`, `conference-room.jpg` | The gallery ("Inside the hotel"): the owner's own photographs, and wider stills from the promo film — the building from the air, the function hall, the meeting room |
| `assets/js/scene.js` | A 3D gold lotus — only used if the Ram & Sita picture is taken out of the hero |
| `assets/video/` | The hero loop (2.5 MB) and the full hotel tour (13.9 MB), cut from the hotel's promo film; the presenter's welcome film (12 MB) in "About the hotel"; and their cover pictures |
| `VIDEO-BRIEF.md` | How the hero video was cut, who sees what, and how to replace it |
| `3D-ASSETS.md` | How to put a 3D model in the hero (not used at present) |

---

## The design

Professional and photo-led, with glass used sparingly. An earlier version put glass, gold
gradients and glowing "orbs" everywhere and looked like a template; now glass appears only where
there is a real photograph behind it to frost.

- **Palette.** The hotel's own colours, one per section below the hero: warm ivory with a
  marigold glow for the welcome; the logo's sindoor red (`#BB3E3B`) as a rich patterned band for
  the restaurant and events; a dusk sky — the hero's azure deepening into temple wine — for
  Janakpur; marigold for the contact section; deep indigo for the footer. Buttons and links stay
  the logo's red, so the site and the signage match. The tokens are at the top of the
  *COLOUR BELOW THE HERO* block in `site.css`.
- **Ornament comes from Mithila painting**, the city's own art: a border band of triangles and
  dots along the section edges, the dusk's scalloped edge hanging into the contact section, the
  lotus under each heading, and the paired Mithila fish (a sign of good fortune at weddings)
  either side of it for Janakpur. All of it is inline SVG and CSS — nothing extra downloads.
  The lobby photo and the enquiry form sit in double gold-and-red frames, like a painted border.
  A second layer adds a marigold toran (garland) hung across the top of the welcome, Mithila
  sun mandalas as faint gold watermarks, a row of lit diyas at the foot of the Janakpur dusk
  (their flicker stops for visitors who ask for less motion), gold corner flourishes on the
  lobby and temple pictures, festival bunting on the place cards, gold diamonds either side of
  each label, and a fine double gold frame inside the red and dusk bands.
- **The hero** is a glass window over the hotel's own film, after the "Voyago" travel-site
  design. The film fills the hero; a pane of azure glass sits inset from the screen's edges, so
  the film shows through it and around it. Inside the frame, top to bottom: the header (its links in the
  middle, the phone and a white "Book now" pill on the right), "Watch the hotel tour", the
  headline, the availability bar, a three-way switch — **Rooms**, **Dining & events**,
  **Janakpur** — over a row of cards, and the facts guests ask first along the foot.
- **The glass is bright and blue.** The frame is one even, light azure wash (`--tint` in
  `site.css`) with a white rim and a soft cyan glow, a little deeper along the top edge where the
  links sit. Behind the other white type — the headline and paragraph, the row's label, the facts
  — soft-edged panels of a deeper azure (`--tint-deep`) are attached to the type itself, so
  everywhere else the film reads clearly. The tour pill, the availability bar, the switch and the
  cards are light frost with a blue cast and navy type (`--sky-ink`), which stays legible whatever
  the film is showing; the place pill is the one piece of deep-blue glass, with white type.
  "Check availability" stays the brand red: the one warm thing in the blue.
- **The cards** are that frost, with an ice rim and a faint cyan halo: a photograph fading into
  the card, a pill and an arrow over it,
  then the name, a line, small chips and the price (or the opening hours, or the walk). The whole
  card is one link. The row runs out to the frame's edge, so the last card is cut by the glass —
  the cue to swipe; on wide screens arrows appear when there is more.
- **The rooms live in the hero now.** The cards carry everything the old Rooms section did —
  name, sleeps, beds, size, line, price, "Check availability" — so that section is gone, and
  "Rooms" in the menu goes to the hero's row (and switches it back to Rooms).
- **On phones and tablets** the film plays in a rounded band at the top of the frame instead
  (4:3, 16:9 on tablets) — sharp and nearly whole — with the lobby photograph as a soft,
  blue-washed ground behind the frame.
- **Glass** — only in the hero, where there is a moving picture behind it to frost — and the
  header once the page scrolls. Each has a fallback for browsers without `backdrop-filter` that
  stays legible on its own.
- **Type.** Inter for the hero, as in the design it follows; Cormorant Garamond for the
  headings below it, Inter for everything else, Tiro Devanagari Hindi for जनकपुरधाम.
- **Photographs carry the page**, in softly rounded frames with a light shadow; room and place
  photos ease in slightly on hover. A **gallery** of nine real photographs, between the red band
  and the dusk, opens each one large (arrows, swipe, keyboard).
- **Video, three ways:** the silent loop in the hero; the full promo film behind "Watch the
  hotel tour"; and the presenter's welcome film, playing in place in "About the hotel", in the
  gold-and-sindoor frame the lobby photo had, with its play button in the corner so her face
  stays clear. The two with sound download only when tapped, and only one plays at a time.
- **English and नेपाली.** A switch in the header; Nepali uses Devanagari faces (Tiro Devanagari
  for headings, Noto Sans Devanagari for text, loaded only for Nepali readers) and no
  letter-spacing anywhere.
- **Phone and WhatsApp** are always close: in the phone's bottom bar, and on larger screens as
  two pills that float in the corner once the hero has gone. (The phone pill used to sit in the
  header; beside six links and the language switch it no longer fits at any width.)
- **Lord Ram and Mata Sita** are out of the hero for now (see CONTENT-TODO, section 5). The
  picture and its script are kept for when they return.
- **Motion** is limited to the film, short fades and the photograph's slow drift, and all of
  it stops for visitors who ask their device for less motion.

---

## How the booking flow works

There is no booking engine. Three paths lead to you:

1. **The availability bar** in the hero, under the headline. A guest picks dates and guests,
   presses the button, and the page carries those values down into the enquiry form so nothing
   is typed twice.
2. **The enquiry form** emails you through Formspree. While `formspreeId` is empty it opens
   WhatsApp with the enquiry already written out instead, so the form is never a dead end.
3. **WhatsApp and Call** — in the contact section, the footer, the phone menu, and a bar that
   rises from the bottom of the screen on phones (two floating pills on larger screens).

Every room card in the hero, the **Vivaha Panchami**, **Weddings and functions** and **Meeting
room** cards, **Ask about festival dates** under Vivaha Panchami, and **Enquire about an event**
under Weddings pre-select the matching option in the form. The restaurant and front-desk cards
open those tabs in the facilities section instead.

Dates are built from local parts, never `toISOString()`: Nepal is UTC+5:45, and converting to
UTC rolls the date back a day.

---

## Photo credits

The large Janaki Mandir picture is the hotel's own. The three smaller photographs of Janakpur
are from Wikimedia Commons, under Creative Commons licences that allow commercial use **as
long as the photographer is credited**. The credits sit at the foot of the Janakpur section in
`index.html` — keep them with the photos, and if you replace a photo with your own, remove its
credit.

| File | Photographer | Licence |
|---|---|---|
| `janaki-mandir-night.jpg` | [Tulsi Bhagat](https://commons.wikimedia.org/wiki/File:Janaki_Mandir,_Janakpur_20211009.jpg) | CC BY-SA 4.0 |
| `ponds.jpg` | [Bijay Chaurasia](https://commons.wikimedia.org/wiki/File:Sunset_at_Ganga_Sagar,_Janakpurdham_11.jpg) | CC BY-SA 4.0 |
| `mithila-art.jpg` | [Abhishek Singh](https://commons.wikimedia.org/wiki/File:Mithila_Painting_artist_-_Flickr_-_askmeaks.jpg) | CC BY-SA 2.0 |

---

## Deliberate, and easy to break by tidying

Each of these was a real bug found while building the page. They are commented in the code too.

1. **The masthead has two looks.** Over the hero it sits inside the glass frame, transparent
   with light type; once the page scrolls (`.is-stuck`, set by `main.js`) or the phone menu
   opens, it rises to the top as a white bar with dark type. The phone-menu case uses `:has()`,
   because the menu is white too and the light header type would vanish against it. It is laid
   out on the frame's own numbers (`--frame-x`, `--frame-y`, `--frame-pad`, `--frame-max`, at
   the top of `site.css`) — change the frame there, never in one place only, or the header
   slides out of it.
2. **`scene.js` is loaded as a classic script, not `type="module"`.** A module loaded from disk
   is blocked by CORS on `file://`, so it would never run when the page is double-clicked.
3. **The form's status line and error states are plain classes in `site.css`.** `main.js`
   overwrites the status line's whole `className` and toggles `.is-bad` on each field's parent.
4. **The default icon size uses `:where()`.** An unsized inline SVG balloons to 300×150, so
   `site.css` gives SVGs a floor — at zero specificity, so any class still wins.
5. **"Wi‑Fi" uses a non-breaking hyphen** (`&#8209;`), or it splits across lines as "Wi- / Fi".
6. **All three `<video>` tags have `preload="none"` and their file in `data-src`, not `src`.**
   `film.js` decides first: visitors who asked for less motion or are saving data never
   download the hero loop, and nobody downloads the 14 MB tour or the 12 MB welcome film until
   they press play. Putting a file back in `src`, or adding `autoplay`, would download it for
   everyone.
7. **The photograph and the video share one colour grade, `--hero-grade`** (on `.hero` in
   `site.css`), used by `.hero__bg::after` and `.hero__scrim` alike, and the frame carries the
   rest of the shade. Change the grade in one place and the frame looks the same over both.
   **The frame is tinted, never blurred:** a `backdrop-filter` on it — or an `opacity`,
   `filter` or `mask` on it or on `.deck` — would stop the cards inside frosting the film; they
   would only see the tint. That is also why the entrance fade sits on the glass pieces
   themselves, not on their containers. **The extra shade behind the white type is attached to
   the type** (`.hero__head::before`, `.deck__head::before`, `.strip::before`), not painted on
   the frame at fixed depths: the type's depth changes with the width and with the browser's
   font size, and painted bands both missed it and striped the pane. Those panels sit with the
   film (`z-index: -1`, under the frame's wash) and their soft edges are masks on the panels
   alone. Add white type to the hero and give it the same; then check it over the film's
   brightest rooms (around 8–12 s into the loop), where white type is hardest to read.
   **The lobby photograph also carries `filter: brightness(.85)`** on `.hero__bg img` — at
   every width (phones add a blur and drain its colour) — to bring it to the film's level. It is
   not part of `--hero-grade` and must not be moved into it: that would darken the film too.
8. **The hero loop contains only caption-free shots.** The promo film has captions burned into
   most shots, and behind the site's own headline they clash. If you re-cut it, check the first
   and last frame of every shot — captions fade in and out over half a second (see
   VIDEO-BRIEF.md).
9. **The page always opens at the top, on the hero.** Left alone, a phone reopens a page where it
   was last scrolled to, and a link copied after tapping "Rooms" carries `#rooms` and jumps
   there — so guests landed mid-page. Two pieces fix it, and both must stay:
   - the small `<script>` near the top of `index.html`'s `<head>` turns off the browser's
     scroll-restoring and takes any `#…` off the address — **before** the page is built, so
     nothing jumps. Moved later (say, into `main.js`), the page would visibly jump down and back;
   - "section jumps" in `main.js` scroll every `href="#…"` link without putting `#…` back in
     the address, and keep each jump in the browser's history so the phone's Back button still
     returns to where the guest was. Add new section links as ordinary `<a href="#section">` —
     they are picked up automatically.
10. **The hero's photograph and film stick to the top of the screen** while the hero scrolls
    past, rather than stretching to its full height (a 720p film enlarged to a hero taller than
    the screen would blur). That needs `overflow: clip` on `.hero`; `overflow: hidden` would
    silently stop it.
11. **The enquiry form's Room options carry fixed English `value`s.** The visible words are
    translated into Nepali, but the room cards pick an option by its value, and the value is what
    reaches the hotel. Remove the values and both break in Nepali.
12. **Nepali works by matching English text exactly** (see `i18n.js`). Change an English sentence
    on the page and its Nepali stops appearing until `i18n-ne.js` gets the new English as its
    left-hand side. Nothing breaks — that sentence just stays in English in Nepali mode.
13. **The header is full.** Logo, six links, the language switch and "Book now" fill the bar at
    every width (it stops growing at 78rem). Between 1024 and 1280 the links already sit a little
    closer. Adding a seventh link or a pill means taking something out — check at 1024 and 1440,
    in both languages.

---

## Publishing it

**Netlify or Vercel** — drag this folder onto their dashboard.

**Ordinary web hosting (cPanel)** — upload the whole folder into `public_html` over FTP.

Then replace `hotelperfectplaza.com` with your real domain in `index.html`, `sitemap.xml` and
`robots.txt`.

---

## Browser support

Current Chrome, Edge, Firefox and Safari, on desktop and phone. All text meets WCAG AA contrast.
The only outside files the page needs are the Google Fonts; without them it falls back to
Georgia and the system sans-serif and still works.
