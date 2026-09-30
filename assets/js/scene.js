/* ==========================================================================
   Hotel Perfect Plaza — the golden lotus
   --------------------------------------------------------------------------
   A lotus in burnished gold, blooming open as the page loads and turning
   slowly in golden-hour light, with a halo behind it and dust drifting up
   through the light. The lotus is Lakshmi's seat and Sita's emblem, and it
   carries the divine theme without depicting anyone.

   What makes it read as metal rather than as yellow plastic:
     • an ENVIRONMENT MAP. Metal shows only what it reflects, and with nothing
       to reflect gold renders near-black. RoomEnvironment is generated here
       rather than downloaded, so there is no HDR file to fetch.
     • physically based gold: metalness 1, low roughness, a clearcoat.
     • three lights for golden hour — a warm key, a cool rim to lift it off
       the midnight ground, and a saffron glow from below.
     • ACES filmic tone mapping, so the highlights roll off like a photograph
       instead of clipping.

   Everything degrades. No WebGL, a blocked CDN, or a failed model load all
   leave the static lotus in place, and it only hands over once the first
   frame has actually been drawn.

   To use a real 3D model instead, set data-model on the scene element — see
   3D-ASSETS.md.
   ========================================================================== */

/* Loaded as a CLASSIC script, with Three.js brought in by dynamic import().
   A <script type="module" src="..."> is blocked by CORS when the page is
   opened straight from disk (file://), which is how this site is opened
   while it is being worked on — the lotus would silently never appear.
   Dynamic import from a classic script fetches from the CDN over HTTPS,
   which the CDN allows, so it works either way. */

(function () {
"use strict";

const host = document.querySelector("[data-scene]");
if (!host) return;
/* Lord Ram & Mata Sita (hero-figure.js) hold this column now. Stop here,
   before Three.js is even downloaded; the static lotus remains the fallback. */
if (host.querySelector("[data-figure]")) return;

let THREE, RoomEnvironment;

Promise.all([
  import("three"),
  import("three/addons/environments/RoomEnvironment.js")
]).then(([three, env]) => {
  THREE = three;
  RoomEnvironment = env.RoomEnvironment;
  return start(host);
}).catch(err => {
  console.info("Hotel Perfect Plaza — the 3D lotus could not start, so the static one stays.", err);
});

async function start(host) {
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* The hero film, once there is one, replaces the lotus (see film.js). If
     it arrived before Three.js finished downloading, do not build the scene
     at all; if it arrives later, the listener below stops the drawing. */
  const hero = host.closest(".hero");
  const filmed = () => !!hero && hero.classList.contains("has-film");
  if (filmed()) return;

  const probe = document.createElement("canvas");
  if (!(probe.getContext("webgl2") || probe.getContext("webgl"))) return;

  /* ---------------------------------------------------------------- renderer */

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  /* Capped at 2: a 3x phone screen would render 2.25x the pixels for a
     difference nobody can see. */
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const LOOK = new THREE.Vector3(0, 0.88, 0);
  const CAM = new THREE.Vector3(0, 3.0, 8.4);
  camera.position.copy(CAM);
  camera.lookAt(LOOK);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  /* golden hour */
  const key = new THREE.DirectionalLight(0xffe2b4, 2.6);
  key.position.set(-3.2, 5, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x86a6ff, 1.25);
  rim.position.set(3.5, 2.2, -5);
  scene.add(rim);
  const under = new THREE.PointLight(0xff9a3c, 16, 9, 2);
  under.position.set(0, -0.3, 2.3);
  scene.add(under);

  /* --------------------------------------------------------------- materials */

  const gold = new THREE.MeshPhysicalMaterial({
    color: 0xcfa437, metalness: 1, roughness: 0.24,
    clearcoat: 0.45, clearcoatRoughness: 0.22,
    envMapIntensity: 1.3, side: THREE.DoubleSide
  });
  /* the outer ring a shade deeper and softer, so the rings separate */
  const goldDeep = gold.clone();
  goldDeep.color.set(0xc0902c);
  goldDeep.roughness = 0.33;

  /* ------------------------------------------------------------------- lotus */

  /* Raised and enlarged so the flower sits in the middle of its halo rather
     than at the foot of it. */
  const LIFT = 0.36;
  const lotus = new THREE.Group();
  lotus.scale.setScalar(1.3);
  lotus.position.y = LIFT;
  scene.add(lotus);

  const petals = [];
  if (host.dataset.model) {
    await addModel(host.dataset.model, lotus);
  } else {
    buildLotus(lotus, petals, gold, goldDeep);
  }

  /* the halo: two fine gold rings standing behind the flower */
  const haloMat = new THREE.MeshPhysicalMaterial({
    color: 0xf3e5ab, metalness: 1, roughness: 0.28,
    emissive: 0x8a6a1a, emissiveIntensity: 0.35
  });
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.013, 16, 220), haloMat);
  const halo2 = new THREE.Mesh(new THREE.TorusGeometry(1.66, 0.006, 12, 220), haloMat);
  halo.position.set(0, 0.95, -1.3);
  halo2.position.copy(halo.position);
  scene.add(halo, halo2);

  /* a pool of warm light beneath, as if on water */
  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 4.4),
    new THREE.MeshBasicMaterial({
      map: radialTexture("rgba(232,160,70,0.9)", "rgba(212,175,55,0)"),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.34
    })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = LIFT - 0.02;
  scene.add(pool);

  const dust = makeDust(calm ? 0 : 240);
  scene.add(dust.points);

  /* ------------------------------------------------------------------ sizing */

  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    /* on a narrow screen pull back, so the open flower is never cropped */
    camera.position.z = CAM.z * (camera.aspect < 1 ? 1.28 : 1);
    camera.updateProjectionMatrix();
    if (calm) renderer.render(scene, camera);
  };
  new ResizeObserver(resize).observe(host);
  resize();

  /* ------------------------------------------------------------------ motion */

  const aim = { x: 0, y: 0 }, now = { x: 0, y: 0 };
  if (!calm) {
    window.addEventListener("pointermove", e => {
      aim.x = e.clientX / window.innerWidth - 0.5;
      aim.y = e.clientY / window.innerHeight - 0.5;
    }, { passive: true });
  }

  const BLOOM = 2.8;                     /* seconds for the flower to open */
  const clock = new THREE.Clock();

  const frame = () => {
    const t = clock.getElapsedTime();

    /* The bloom: every petal starts closed and opens to its ring's angle,
       the inner rings a beat behind the outer ones. */
    for (const p of petals) {
      const k = THREE.MathUtils.clamp((t - p.delay) / BLOOM, 0, 1);
      const eased = 1 - Math.pow(1 - k, 3);
      p.mesh.rotation.x = p.closed + (p.open - p.closed) * eased
                        + Math.sin(t * 0.9 + p.phase) * 0.014 * eased;
    }

    lotus.rotation.y = t * 0.11;
    lotus.position.y = LIFT + Math.sin(t * 0.8) * 0.05;
    halo.rotation.z = t * 0.05;
    halo2.rotation.z = -t * 0.07;
    dust.tick();

    now.x += (aim.x - now.x) * 0.04;
    now.y += (aim.y - now.y) * 0.04;
    camera.position.x = now.x * 0.7;
    camera.position.y = CAM.y - now.y * 0.45;
    camera.lookAt(LOOK);

    renderer.render(scene, camera);
  };

  if (calm) {
    /* one still frame, fully open */
    for (const p of petals) p.mesh.rotation.x = p.open;
    renderer.render(scene, camera);
  } else {
    /* Stop rendering when nobody can see it — scrolled away, the tab in the
       background, or the hero film has taken over. A render loop left
       running costs battery all day. */
    let onScreen = true;
    const sync = () => renderer.setAnimationLoop(
      onScreen && !document.hidden && !filmed() ? frame : null);
    new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; sync(); }).observe(host);
    document.addEventListener("visibilitychange", sync);
    document.addEventListener("hpp:film", sync);
    frame();
    sync();
  }

  /* only now, with a frame on the canvas, does it take over */
  host.classList.add("is-live");
}

/* ============================================================== THE FLOWER */

function buildLotus(group, petals, gold, goldDeep) {
  const geo = petalGeometry();

  /* four rings, outermost widest open; each offset half a petal from the
     ring outside it, the way a real lotus is stacked */
  const rings = [
    { n: 9, radius: 0.24, open: 1.2,  scale: 1.0,  twist: 0,  mat: goldDeep },
    { n: 9, radius: 0.19, open: 0.86, scale: 0.9,  twist: 20, mat: gold },
    { n: 8, radius: 0.14, open: 0.52, scale: 0.77, twist: 0,  mat: gold },
    { n: 6, radius: 0.08, open: 0.22, scale: 0.6,  twist: 30, mat: gold }
  ];

  rings.forEach((ring, r) => {
    for (let i = 0; i < ring.n; i++) {
      const pivot = new THREE.Group();
      pivot.rotation.y = THREE.MathUtils.degToRad(ring.twist + (360 / ring.n) * i);
      const mesh = new THREE.Mesh(geo, ring.mat);
      mesh.scale.setScalar(ring.scale);
      mesh.position.z = ring.radius;
      pivot.add(mesh);
      group.add(pivot);
      petals.push({ mesh, open: ring.open, closed: 0.04, delay: r * 0.22, phase: i * 0.7 + r });
    }
  });

  /* the seed pod, with its seeds set into the top */
  const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.17, 0.17, 48), goldDeep);
  pod.position.y = 0.36;
  group.add(pod);
  const seedGeo = new THREE.SphereGeometry(0.022, 16, 12);
  for (let i = 0; i < 13; i++) {
    const a = i * 2.39996, rr = 0.045 * Math.sqrt(i + 0.5);   /* golden-angle spiral */
    const seed = new THREE.Mesh(seedGeo, gold);
    seed.position.set(Math.cos(a) * rr, 0.45, Math.sin(a) * rr);
    group.add(seed);
  }
}

/* A single petal: a pointed leaf outline, given thickness and a rounded
   edge, then cupped across its width so it holds the centre, and curled
   back at the tip. */
function petalGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.34, 0.18, 0.43, 0.8, 0, 1.34);
  s.bezierCurveTo(-0.43, 0.8, -0.34, 0.18, 0, 0);

  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.012, curveSegments: 30, steps: 1,
    bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.016, bevelSegments: 3
  });

  const pos = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    /* The petal sits out along +z from the centre, so pulling its edges
       toward -z cups it around the middle of the flower; pushing the tip
       toward +z curls it outward. */
    v.z += -v.x * v.x * 0.95 + v.y * v.y * 0.1;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/* ============================================================ A REAL MODEL */

/* Load a .glb in place of the generated flower: centred, scaled to the same
   size, and given the page's lighting. Both mesh compressions are decoded —
   Draco, and Meshopt, which is what `gltf-transform optimize` produces by
   default. With only Draco wired, the obvious optimisation step would yield
   a model that silently fails to load. See 3D-ASSETS.md. */
async function addModel(url, group) {
  const [{ GLTFLoader }, { DRACOLoader }, { MeshoptDecoder }] = await Promise.all([
    import("three/addons/loaders/GLTFLoader.js"),
    import("three/addons/loaders/DRACOLoader.js"),
    import("three/addons/libs/meshopt_decoder.module.js")
  ]);

  const draco = new DRACOLoader();
  draco.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/");
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder(MeshoptDecoder);

  const gltf = await loader.loadAsync(url);
  const model = gltf.scene;

  /* Fit height and footprint separately. Capping only the largest dimension
     suits the wide, low lotus the camera is framed for, but crops anything
     tall — a statue, a temple — straight off the top of the frame. */
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const scale = Math.min(2.0 / size.y, 2.9 / Math.max(size.x, size.z));
  model.scale.setScalar(scale);

  box.setFromObject(model);
  const centre = box.getCenter(new THREE.Vector3());
  model.position.x -= centre.x;
  model.position.z -= centre.z;
  model.position.y -= box.min.y;

  group.add(model);
  draco.dispose();
}

/* =============================================================== GOLD DUST */

function makeDust(count) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const speed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = 0.7 + Math.random() * 2.7, a = Math.random() * Math.PI * 2;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = Math.random() * 3.4 - 0.4;
    pos[i * 3 + 2] = Math.sin(a) * r - 0.6;
    speed[i] = 0.0016 + Math.random() * 0.0032;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));

  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xf3e5ab, size: 0.03, sizeAttenuation: true,
    map: radialTexture("rgba(255,255,255,1)", "rgba(255,255,255,0)", 64),
    transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending
  }));

  const tick = () => {
    for (let i = 0; i < count; i++) {
      let y = pos[i * 3 + 1] + speed[i];
      if (y > 3) y = -0.4;
      pos[i * 3 + 1] = y;
    }
    geo.attributes.position.needsUpdate = true;
  };
  return { points, tick };
}

/* A soft radial disc drawn on a canvas — for the pool of light and for the
   dust, so neither needs an image file. */
function radialTexture(inner, outer, size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

})();
