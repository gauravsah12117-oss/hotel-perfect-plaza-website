# The hero video

Both videos on the site are cut from the hotel's own promotional film (72.9 seconds, 1280 × 720,
with music), supplied as `Desktop\Travel cotation\hero page video.mp4`. The original stays there;
only the web versions are in this folder.

| File | What it is | Size |
|---|---|---|
| `assets/video/hotel-hero.mp4` | A **12.6-second silent loop** behind the hero's headline | 2.5 MB |
| `assets/video/hotel-tour.mp4` | The **full film, with its music**, opened by "Watch the hotel tour" | 13.9 MB |
| `assets/video/hotel-tour-poster.jpg` | The tour player's cover picture — the drone shot of the building. Also the cover of the hero's video band on phones | 0.2 MB |

---

## How the loop was cut

The promo film has captions burned into most shots ("LOCATED NEAR JANAKI TEMPLE", "WELL LIT
AND SPACIOUS ROOMS"…). Behind the site's own headline those would clash, so the loop uses
**only the caption-free stretches**, each checked frame by frame at the edges:

| Order | From the film | Shows |
|---|---|---|
| 1 | 6.00 – 7.95 s | The drone shot of the hotel building |
| 2 | 15.10 – 18.30 s | Walking into the lobby |
| 3 | 18.40 – 21.00 s | The reception desk |
| 4 | 48.40 – 51.15 s | A double room with a window |
| 5 | 57.30 – 61.40 s | A slow pan across a bright room |

The shots are joined with 0.4-second crossfades. The first 0.4 s of the building shot is moved to
the very end, so the last crossfade lands exactly where the loop starts again — the repeat is
invisible.

## Where it plays

The hero is a glass frame over the film (see README, *The design*):

- **Wide screens (1024 px and up)** — the film fills the whole hero, behind the frame, so it
  shows through the tinted glass and around its edges. It holds one screen's height and stays put
  while the hero scrolls past, rather than being stretched — and blurred — to the hero's full
  height.
- **Phones and tablets** — a 16:9 film behind an upright screen would show a sliver of each shot,
  enlarged until it blurs, so here it plays in a rounded band at the top of the frame instead: 4:3
  on phones, 16:9 on tablets. Until the loop starts, the band shows the tour's cover picture — the
  same drone shot the loop opens on, so the change is barely visible.

## Who sees what

- **Most visitors** — the lobby photograph first (on phones, the band's cover picture), then the
  loop fading in over it once it has loaded. The same colour grade (`--hero-grade` in
  `site.css`) sits over both; the photograph is also dimmed a little on its own
  (`brightness(.85)`), because the lobby is shot brighter than the film.
- **Visitors who ask for less motion, or are saving data / on 2G** — the photograph (on phones,
  the cover picture) only; the loop is never downloaded.
- **If a phone refuses to autoplay** (an iPhone in Low Power Mode does, even muted) — the same.
- The loop **pauses** when it is scrolled off the screen (on phones, as soon as the band has gone,
  though the hero runs on below it), the tab is hidden, or the tour is open.
- The tour downloads **only when someone presses "Watch the hotel tour"**. Without JavaScript,
  that link simply opens the video file.

---

## Stills from the film

Two photographs on the site are single frames of the promo film, because there are no photos
of these rooms yet. (A third, the dining hall, has since been replaced by the hotel's own photo
of the restaurant.) Each is taken from a moment with no caption on screen, and cropped above
where the captions sit:

| File | From the film | Shows | Used in |
|---|---|---|---|
| `assets/images/banquet.jpg` | 27.40 s | The buffet counter in the dining hall | The weddings card and tab |
| `assets/images/meeting-room.jpg` | 27.00 s | The meeting room | The meeting-room card |

```
ffmpeg -ss 27.40 -i hotel-tour.mp4 -frames:v 1 -vf "crop=746:512:330:208,eq=saturation=0.95" -q:v 3 banquet.jpg
ffmpeg -ss 27.00 -i hotel-tour.mp4 -frames:v 1 -vf "crop=930:640:300:70,eq=saturation=0.95" -q:v 3 meeting-room.jpg
```

They are as sharp as a 720p film allows — fine on a card, a little soft larger. A real photograph
with the same file name replaces each one; update the `width` and `height` on its `<img>` tags.

## Replacing a video

Keep the same file names and nothing else needs changing. To re-cut the loop from a new film, the
commands used are below (they need the free `ffmpeg`, installed on this computer through winget).
Pick caption-free, steady shots of 2–4 seconds each; update the `trim` times and the `xfade`
offsets (each offset = the length so far − 0.4).

```
ffmpeg -i "hero page video.mp4" -filter_complex "
  [0:v]trim=6.40:7.95,setpts=PTS-STARTPTS,fps=30,format=yuv420p[a];
  [0:v]trim=15.10:18.30,setpts=PTS-STARTPTS,fps=30,format=yuv420p[b];
  [0:v]trim=18.40:21.00,setpts=PTS-STARTPTS,fps=30,format=yuv420p[c];
  [0:v]trim=48.40:51.15,setpts=PTS-STARTPTS,fps=30,format=yuv420p[e];
  [0:v]trim=57.30:61.40,setpts=PTS-STARTPTS,fps=30,format=yuv420p[f];
  [0:v]trim=6.00:6.40,setpts=PTS-STARTPTS,fps=30,format=yuv420p[h];
  [a][b]xfade=transition=fade:duration=0.4:offset=1.15[ab];
  [ab][c]xfade=transition=fade:duration=0.4:offset=3.95[abc];
  [abc][e]xfade=transition=fade:duration=0.4:offset=6.15[abce];
  [abce][f]xfade=transition=fade:duration=0.4:offset=8.50[abcef];
  [abcef][h]xfade=transition=fade:duration=0.4:offset=12.20[v]"
  -map "[v]" -an -c:v libx264 -preset slow -crf 26 -profile:v high -level 4.0
  -pix_fmt yuv420p -movflags +faststart hotel-hero.mp4

ffmpeg -i "hero page video.mp4" -c:v libx264 -preset slow -crf 25 -profile:v high -level 4.0
  -pix_fmt yuv420p -c:a aac -b:a 128k -ac 2 -movflags +faststart hotel-tour.mp4

ffmpeg -ss 7.0 -i "hero page video.mp4" -frames:v 1 -q:v 3 hotel-tour-poster.jpg
```

Keep the loop **under about 5 MB** (it downloads for every visitor with a normal connection) and
the tour **under 50 MB** (GitHub refuses files over 100 MB). A longer tour belongs on YouTube, with
the "Watch the hotel tour" dialog showing the YouTube player instead — ask and it's a small change.
