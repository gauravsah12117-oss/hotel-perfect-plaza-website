# The hero video

Both videos on the site are cut from the hotel's own promotional film (72.9 seconds, 1280 × 720,
with music), supplied as `Desktop\Travel cotation\hero page video.mp4`. The original stays there;
only the web versions are in this folder.

| File | What it is | Size |
|---|---|---|
| `assets/video/hotel-hero.mp4` | A **12.6-second silent loop** behind the hero's headline | 2.5 MB |
| `assets/video/hotel-tour.mp4` | The **full film, with its music**, opened by "Watch the hotel tour" | 13.9 MB |
| `assets/video/hotel-tour-poster.jpg` | The tour player's cover picture — the drone shot of the building | 0.2 MB |

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

## Who sees what

- **Most visitors** — the lobby photograph first, then the loop fading in over it once it has
  loaded. The same colour grade (`--hero-grade` in `site.css`) sits over both, so the words are
  equally legible either way.
- **Visitors who ask for less motion, or are saving data / on 2G** — the photograph only; the
  loop is never downloaded.
- **If a phone refuses to autoplay** (an iPhone in Low Power Mode does, even muted) — the
  photograph stays.
- The loop **pauses** when the hero is scrolled away, the tab is hidden, or the tour is open.
- The tour downloads **only when someone presses "Watch the hotel tour"**. Without JavaScript,
  that link simply opens the video file.

---

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
