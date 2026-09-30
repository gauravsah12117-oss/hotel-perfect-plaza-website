# Adding high-end 3D to the hero

The hero already runs a real 3D scene: a burnished-gold lotus in Three.js that blooms open as the
page loads, turns slowly in golden-hour light, and sits inside a gold halo with dust drifting up
through it. This guide covers three ways to take it further — **your own 3D model**, a **Spline
scene**, or **tuning the lotus that is there** — and what each costs.

Everything here lives in `assets/js/scene.js`, and the scene is mounted on the element marked
`data-scene` in `index.html`.

---

## Before you start: what the scene already does for you

Whatever you put in, you inherit these, and it is worth keeping them:

- **Lighting that makes metal read as metal.** An environment map (generated in code, so there
  is no HDR file to download), a warm key light, a cool rim light to lift the subject off the
  midnight background, and a saffron glow from below. ACES filmic tone mapping rolls highlights
  off like a photograph instead of clipping them.
- **It stops when nobody is looking.** Rendering pauses when the hero scrolls out of view and
  when the tab is in the background. A render loop left running drains a phone's battery.
- **Pixel ratio capped at 2.** A 3× phone screen would otherwise draw 2.25× the pixels for a
  difference nobody can see.
- **Reduced motion is respected.** Visitors who have asked their device for less motion get one
  still frame, fully open, and nothing moves.
- **It can never leave the hero empty.** A static gold lotus shows first. The 3D canvas only
  takes over after its first frame has actually been drawn — so no WebGL, a blocked CDN, or a
  model that fails to load all leave the static lotus in place.

---

## Option 1 — your own model (`.glb`) — recommended

This is how you get something genuinely bespoke: a sculpted lotus, a golden Kodanda, a model of
the Janaki Mandir façade, or a Ram–Sita murti.

### How to switch it on

1. Put the file in the site, for example `assets/3d/lotus.glb`.
2. In `index.html`, find the scene element and add `data-model`:

   ```html
   <div class="scene order-1 lg:order-2 lg:col-span-6" data-scene data-model="assets/3d/lotus.glb" aria-hidden="true">
   ```

That is the whole change. The generated lotus is skipped, and your model is loaded, scaled,
centred and lit by the same scene.

### ⚠ It will not load from a double-clicked file

A model is fetched over the network, and **browsers refuse to fetch from `file://`**. Opened by
double-clicking `index.html`, the model fails and the static lotus stays — which is the fallback
doing its job, but it means you cannot judge your model that way.

To see it, serve the folder. Any of these, run from inside the site folder, then open
`http://localhost:8000`:

```
npx serve -l 8000
python -m http.server 8000
```

Once the site is on real hosting (Netlify, Vercel, cPanel), this does not apply.

### How the model is fitted

So you know what to expect from a file of any size or orientation:

- Scaled so it is **at most 2 units tall** and its **footprint at most 2.9 units** across —
  height and width are fitted separately, because a single "largest side" limit crops tall
  models off the top of the frame.
- **Centred** horizontally, with its **base resting on the floor**, above the pool of light.
- The whole group is then lifted and scaled like the lotus, and turns slowly on its vertical
  axis. Build the model upright (Y-up, which is the glTF standard) and facing the viewer.

### Preparing the model

**Materials.** Use standard PBR materials — metalness and roughness. For gold: metalness 1,
roughness around 0.2–0.35, base colour around `#D4AF37`. **Do not bake lighting into the
textures**; the scene supplies it, and baked light will fight the real light and look flat.

**Compression.** Both common mesh compressions are supported:

| Compression | Status |
|---|---|
| **Draco** | Tested end to end |
| **Meshopt** (what `gltf-transform optimize` produces by default) | Decoder loaded and wired in; not yet tested with a Meshopt-compressed file |
| **KTX2 / Basis textures** | **Not supported** — use WebP or JPEG textures instead |

A typical optimisation pass, using [glTF-Transform](https://gltf-transform.dev):

```
npx @gltf-transform/cli optimize lotus.glb lotus-web.glb --texture-compress webp
```

Check `npx @gltf-transform/cli optimize --help` for the options on your version; they have
changed between releases.

**Budget.** Aim for:

| | Target | Hard ceiling |
|---|---|---|
| File size | under 1.5 MB | 3 MB |
| Triangles | under 100k | 150k |
| Textures | 1024–2048 px | 2048 px |

Over the ceiling, mid-range Android phones — much of your audience — will stutter or be slow to
show anything but the fallback.

### Where to get one

- **Commission a 3D artist.** The only way to get something that is yours alone. A sculpted
  lotus in gold is a modest job; a detailed murti is a larger one. Ask for a `.glb` with PBR
  materials under the budget above.
- **Buy one.** CGTrader, TurboSquid and Sketchfab's store. Read the licence: you need
  **commercial use**, and a hotel website is commercial.
- **Free models** on Sketchfab are often CC-BY, which allows commercial use *but requires
  visible credit* — add it to the footer if you use one.
- **Photogrammetry of the real Janaki Mandir** is possible and would be remarkable, but get
  permission from the temple trust first.

---

## Option 2 — a Spline scene

[Spline](https://spline.design) is a browser-based 3D design tool. It is quicker than a custom
model if a designer on your side already uses it, because materials, lighting and interaction
are all set up visually.

**Not tested here** — there is no Spline scene to test with. The steps below are Spline's
documented pattern; use the exact snippet its export dialog gives you.

1. Build the scene in Spline and export it for the web (*Export → Code Export* or *Viewer*).
   Spline gives you a scene URL ending in `.splinecode`.
2. In `index.html`, replace the **inside** of the scene element — keep the `div` itself for its
   size and position — with the viewer:

   ```html
   <div class="scene order-1 lg:order-2 lg:col-span-6" aria-hidden="true">
     <spline-viewer url="https://prod.spline.design/YOUR-SCENE-ID/scene.splinecode"></spline-viewer>
   </div>
   ```

3. Add the viewer script just before `</body>`, using the version Spline shows you:

   ```html
   <script type="module" src="https://unpkg.com/@splinetool/viewer@VERSION/build/spline-viewer.js"></script>
   ```

4. Remove `data-scene` from that element, or remove the `scene.js` script tag, so the two do not
   both try to draw into it.

**What you give up.** The Spline runtime is considerably heavier than this scene, it has none of
the fallback, pause-when-hidden or reduced-motion handling described above, and its lighting
will not match the page's golden hour unless you rebuild it in Spline. Test on a phone before
committing to it.

---

## Option 3 — tune the lotus that is there

Everything below is near the top of `assets/js/scene.js`.

| To change… | Edit |
|---|---|
| How many petals, how open each ring is | the `rings` array in `buildLotus` — `n` petals, `open` angle in radians, `scale` |
| The shape of a petal | `petalGeometry` — the two bezier curves, and the `cup` / `curl` line |
| The gold itself | the `gold` material — `color`, `roughness` (lower is shinier), `clearcoat` |
| Overall brightness | `renderer.toneMappingExposure` |
| How long the bloom takes | `BLOOM`, in seconds |
| The light | `key` (warm, from upper left), `rim` (cool, from behind), `under` (saffron, from below) |
| The halo | `halo` and `halo2` — radius and thickness are the first two numbers of each `TorusGeometry` |
| How fast it turns | `lotus.rotation.y = t * 0.11` in `frame` |

---

## Before going live with any change

- [ ] Open the site **served**, not double-clicked, and confirm the 3D appears
- [ ] Check it on a real mid-range phone, not only a laptop
- [ ] Turn on *Reduce motion* in your device settings and confirm you get a still, open lotus
- [ ] Throttle to a slow connection in your browser's developer tools and confirm the static
      lotus shows while the 3D loads
- [ ] If you used a model under a CC-BY licence, confirm the credit is on the page
