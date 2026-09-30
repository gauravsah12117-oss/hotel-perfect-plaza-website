# The hero film — brief

A short, calm, looping film of **Lord Ram before the Janaki Mandir**, played behind the headline
at the top of the website. This page is everything needed to make it and put it on the site —
whether you make it yourself with an AI video tool or hand it to a studio.

**The site is already built for it.** Save the finished file into `assets/video/` with the right
name and it plays on its own. Until then, the golden lotus carries the hero, so nothing is
waiting on this.

---

## What it has to be

It is a **background**, not a trailer. People read the headline over it and book a room, so it
must stay calm:

- **Ram on the right third** of the frame. The left side of the screen is darkened for the
  headline and the booking bar, so anything placed there will be dimmed.
- **A locked-off camera.** No push-in, no orbit, no zoom. A moving camera cannot loop: the
  shot jumps back every few seconds.
- **A seamless loop**, 8–10 seconds, ending on the frame it began with.
- **Slow, small movement only** — breathing, a breeze in the silk and hair, dust drifting
  through the light.

---

## The prompt

Paste this into an AI video tool (Google Veo, OpenAI Sora, Runway, Kling and similar):

```
Cinematic, photorealistic shot of Lord Ram standing majestically, framed on the right third of a 16:9 widescreen frame, leaving calm negative space on the left for website text. Medium-wide shot at eye level. Static, locked-off camera: no camera movement, no zoom, no cuts.

He has a serene, welcoming expression and is adorned in exquisite flowing saffron silk and traditional gold jewellery. He rests his hand on the Shiva Dhanush.

Behind him, the white marble Janaki Mandir in Janakpurdham, Nepal, softly out of focus with a shallow depth of field so it does not compete with the website. Warm golden-hour light, soft god rays, a gentle divine glow. Subtle Mithila art motifs in the polished marble floor.

Seamless 8–10 second loop in which the last frame matches the first. Only slow, subtle movement: gentle breathing, a soft breeze in his garments and hair, dust motes drifting slowly through the light. Calm and unhurried, designed as a website background. Photorealistic, Unreal Engine 5 aesthetic, 8K detail.
```

If the tool takes a **negative prompt**:

```
text, captions, subtitles, watermark, logo, cartoon, anime, illustration, plastic skin, distorted hands, extra fingers, extra limbs, camera movement, zoom, camera shake, fast motion, cuts, flicker
```

### The phone version (optional, recommended)

On a phone the headline sits at the **bottom** of the screen, and a widescreen film shows only
a narrow slice of its width. Make a second, upright version: use the same prompt, replacing its
first sentence with

```
Cinematic, photorealistic shot of Lord Ram standing majestically in a vertical 9:16 frame, placed in the upper half of the frame, with calm negative space in the lower half for website text.
```

Without it the site still works — on phones it crops the widescreen film toward the right third,
where Ram stands.

### Two edits for traditional accuracy — your choice

- **The bow.** In the Ramayana, Ram *broke* Shiva's bow here in Janakpur; the bow that is his
  own is the **Kodanda**. The site's Heritage section already says *"Here the bow of Shiva was
  broken"*, so a viewer who knows the story may notice. To change it, replace
  `He rests his hand on the Shiva Dhanush.` with `He rests his hand on his bow, the Kodanda.`
- **His appearance.** Ram is traditionally shown with dark, blue-tinged (*shyam*) skin, and at
  Janakpur as a young prince wearing a gold *mukut*. Unless told, most tools make his skin
  light. To add it, put `with dark, blue-tinged (shyam) skin, a gold mukut and a tilak,` after
  `welcoming expression`.

---

## Getting a good result

- **Make several and choose.** Expect to generate a handful before one is right.
- **Look at the hand first.** "Rests his hand on the bow" puts a hand in clear view, and hands
  are still where AI video most often goes wrong — extra or merged fingers.
- **Check the loop.** Play it on repeat and watch the moment it restarts. If there is a jump,
  use the tool's loop option if it has one, or cross-fade the last half-second into the first in
  a video editor.
- **Keep the character consistent** between the widescreen and phone versions by making one
  still image you like first, then using it as the *start frame* ("image to video") for both.
- **Check your rights.** The hotel's website is commercial use. Make sure the plan you generate
  on allows commercial use of what it produces.

---

## Delivery

Generate at the best quality the tool offers — then deliver **small**. "8K" in the prompt is a
style cue; an 8K file would be hundreds of megabytes and would not play on a phone.

| File | Size | Length | Target | Hard ceiling |
|---|---|---|---|---|
| `ram-hero.mp4` | 1920 × 1080 | 8–10 s | under 6 MB | 10 MB |
| `ram-hero-portrait.mp4` *(optional)* | 1080 × 1920 | 8–10 s | under 5 MB | 8 MB |
| `ram-hero-poster.jpg` *(optional)* | 1920 × 1080 | one frame | under 250 KB | 400 KB |

- **MP4, H.264 video, no sound.** H.264 plays everywhere; newer codecs do not play on older
  iPhones. Background video must be silent — browsers refuse to autoplay anything with sound.
- **24 or 30 frames per second.** 60 doubles the file for movement too slow to show it.
- **The poster** is one still frame — ideally the first. Visitors who have asked their device
  for less motion, or who are saving mobile data, see this instead of the film.

### Making the files small

**With [HandBrake](https://handbrake.fr)** (free, point-and-click): open the generated film,
choose the **Fast 1080p30** preset, tick **Web Optimized**, remove the audio track, and save as
`ram-hero.mp4`. If the result is over 6 MB, lower the quality slider a little and save again.

**With ffmpeg** (command line) — not run here, as ffmpeg is not installed on this machine:

```
ffmpeg -i generated.mp4 -an -vf "scale=1920:-2,fps=30" -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -movflags +faststart ram-hero.mp4
ffmpeg -i generated.mp4 -vf "scale=1920:-2" -frames:v 1 -q:v 3 ram-hero-poster.jpg
```

`-an` removes the sound; `-movflags +faststart` lets it start playing before it has fully
downloaded. Over 6 MB? Raise `-crf 26` to `28`. Visible banding in the sky? Lower it to `23`.

---

## Putting it on the site

Save the files into **`assets/video/`** with exactly the names above. That is all — no editing.

What the site then does, by itself:

| Visitor | Sees |
|---|---|
| Most | The film, fading in over the lotus |
| Phone held upright | The phone version if you made one; otherwise the widescreen film, cropped toward Ram |
| Asked for less motion, or saving data, or on a very slow connection | The poster still — the film is **never downloaded** for them |
| iPhone in Low Power Mode (refuses to autoplay) | The poster still |
| No film file at all | The golden lotus, exactly as now |

The film pauses whenever the top of the page is scrolled away or the tab is in the background,
so it costs no battery or data when nobody is watching.

**Legibility is already handled.** A shade darkens the left of the film behind the headline and
the top behind the menu. It was tested against a near-white film — harsher than any real
footage — and every word in the hero meets the WCAG AA contrast standard over it.

**Before going live**, open the site on a real phone and watch it for a minute: that the film
plays, the loop is smooth, and Ram is not cut off.
