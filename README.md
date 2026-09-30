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
| `assets/js/ui.js` | The facilities tabs, the scroll reveal, the nav link that follows the section in view |
| `assets/js/hero-figure.js` | Fades in Lord Ram & Mata Sita in the hero once the picture has loaded |
| `assets/images/ram-sita.jpg` | That picture (33 KB) — frame 2 of the 12-frame sheet, cut out |
| `assets/images/janaki-mandir.jpg` | The Janaki Mandir lit up at dusk — the hotel's own picture, leading the Janakpur section |
| `assets/images/janaki-mandir-night.jpg`, `mithila-art.jpg`, `ponds.jpg` | Real photographs of Janakpur from Wikimedia Commons — see *Photo credits* below |
| `assets/images/ram-sita-turntable.png` / `.webp` | The original 12-frame sheet, kept as the source. The page does not load it |
| `assets/images/hotel-logo.png` | The real logo, on a white card — used in the header, the footer, and (cropped) as the home-screen icon |
| `assets/js/film.js` | The hero's video loop, and the "Watch the hotel tour" player |
| `assets/js/scene.js` | A 3D gold lotus — only used if the Ram & Sita picture is taken out of the hero |
| `assets/video/` | The hero loop (2.5 MB), the full hotel tour (13.9 MB) and its cover, all cut from the hotel's promo film |
| `VIDEO-BRIEF.md` | How the hero video was cut, who sees what, and how to replace it |
| `3D-ASSETS.md` | How to put a 3D model in the hero (not used at present) |

---

## The design

Professional and photo-led, with glass used sparingly. An earlier version put glass, gold
gradients and glowing "orbs" everywhere and looked like a template; now glass appears only where
there is a real photograph behind it to frost.

- **Palette.** A warm light page (`#FAF7F2`), dark type, and one accent — the logo's own red
  (`#BB3E3B`) for buttons and links, so the site and the signage match.
- **The hero** is the hotel's own lobby, full-bleed and colour-graded twice: once in the file
  (`hero-lobby.jpg` — warmer, slightly less saturated), and again in CSS (a navy wash under the
  words, shade under the booking bar, a warm bloom at the chandeliers). It drifts very slowly.
- **Glass** — the stay-details card and the booking bar in the hero, the "Call reception"
  button, and the header once the page scrolls. Each has a solid fallback for browsers without
  `backdrop-filter`.
- **Type.** Cormorant Garamond for headings, Inter for everything else, Tiro Devanagari Hindi
  for जनकपुरधाम.
- **Photographs carry the page**, in softly rounded frames with a light shadow; room and place
  photos ease in slightly on hover.
- **Lord Ram and Mata Sita** are out of the hero for now (see CONTENT-TODO, section 5). The
  picture and its script are kept for when they return.
- **Motion** is limited to short fades and the hero's slow drift, and all of it stops for
  visitors who ask their device for less motion.

---

## How the booking flow works

There is no booking engine. Three paths lead to you:

1. **The availability bar** under the hero. A guest picks dates and guests, presses the button,
   and the page carries those values down into the enquiry form so nothing is typed twice.
2. **The enquiry form** emails you through Formspree. While `formspreeId` is empty it opens
   WhatsApp with the enquiry already written out instead, so the form is never a dead end.
3. **WhatsApp and Call** — in the header, the contact section, the footer, and a bar that rises
   from the bottom of the screen on phones.

Every **Check availability** button on a room, **Ask about festival dates** under Vivaha
Panchami, and **Enquire about an event** under Weddings pre-selects the matching option in the
form.

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

1. **The masthead has two looks.** Over the dark hero it is transparent with light type; once
   the page scrolls (`.is-stuck`, set by `main.js`) or the phone menu opens, it becomes a white
   bar with dark type. The phone-menu case uses `:has()`, because the menu is white too and the
   light header type would vanish against it.
2. **`scene.js` is loaded as a classic script, not `type="module"`.** A module loaded from disk
   is blocked by CORS on `file://`, so it would never run when the page is double-clicked.
3. **The form's status line and error states are plain classes in `site.css`.** `main.js`
   overwrites the status line's whole `className` and toggles `.is-bad` on each field's parent.
4. **The default icon size uses `:where()`.** An unsized inline SVG balloons to 300×150, so
   `site.css` gives SVGs a floor — at zero specificity, so any class still wins.
5. **"Wi‑Fi" uses a non-breaking hyphen** (`&#8209;`), or it splits across lines as "Wi- / Fi".
6. **Both `<video>` tags have `preload="none"` and their file in `data-src`, not `src`.**
   `film.js` decides first: visitors who asked for less motion or are saving data never
   download the hero loop, and nobody downloads the 14 MB tour until they press "Watch the
   hotel tour". Putting the file back in `src`, or adding `autoplay`, would download both for
   everyone.
7. **The photograph and the video share one colour grade, `--hero-grade`** (on `.hero` in
   `site.css`), used by `.hero__bg::after` and `.hero__scrim` alike. Change it in one place and
   the words stay equally legible over both; give the scrim its own gradient and the headline
   can end up over undarkened video when it fades in.
8. **The hero loop contains only caption-free shots.** The promo film has captions burned into
   most shots, and behind the site's own headline they clash. If you re-cut it, check the first
   and last frame of every shot — captions fade in and out over half a second (see
   VIDEO-BRIEF.md).

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
