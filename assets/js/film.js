/* ==========================================================================
   Hotel Perfect Plaza — the hero film
   --------------------------------------------------------------------------
   Plays a looping background film behind the hero once one exists. Until
   then it does nothing at all and the golden lotus carries the hero; there
   is no setting to change, the file simply has to be there.

     assets/video/ram-hero.mp4            the film, 16:9            required
     assets/video/ram-hero-portrait.mp4   a 9:16 cut for phones     optional
     assets/video/ram-hero-poster.jpg     one still frame           optional

   Who gets what:
     • most visitors             the film, faded in over the lotus
     • phones held upright       the portrait cut if there is one, else the
                                 16:9 film cropped to its right-hand subject
     • "reduce motion" / data    the still frame and no film download at
       saver / a 2G connection   all — or, with no still, the lotus as before
     • autoplay refused          the still frame (an iPhone in Low Power Mode
                                 refuses to autoplay even muted video)

   The film pauses whenever the hero is scrolled away or the tab is hidden.
   See VIDEO-BRIEF.md for how to make the film.
   ========================================================================== */

(function () {
  "use strict";

  const box = document.querySelector("[data-film]");
  if (!box) return;

  const hero  = box.closest(".hero") || document.body;
  const video = box.querySelector("video");
  const DIR   = "assets/video/";
  const STILL = DIR + "ram-hero-poster.jpg";

  const calm   = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const net    = navigator.connection || {};
  const frugal = !!net.saveData || /(^|-)2g$/.test(net.effectiveType || "");
  const upright = window.matchMedia("(max-aspect-ratio: 3/4)").matches;

  /* Does this image exist? Asked with an <img> rather than fetch(), which
     would be refused outright on a page opened straight from disk. */
  const exists = src => new Promise(done => {
    const probe = new Image();
    probe.onload = () => done(true);
    probe.onerror = () => done(false);
    probe.src = src;
  });

  const reveal = still => {
    hero.classList.add("has-film");
    hero.classList.toggle("film-still", still);
    /* on <html> as well, for the header, which sits outside the hero */
    document.documentElement.classList.add("film-on");
    /* scene.js listens for this and stops drawing the lotus */
    document.dispatchEvent(new CustomEvent("hpp:film"));
  };

  const showStill = () => exists(STILL).then(ok => {
    if (!ok) return;                         /* no still either: the lotus stays */
    video.poster = STILL;
    reveal(true);
  });

  /* Reduced motion, a data saver or a very slow line: never download the
     film. A still frame is a few kilobytes; the film is several megabytes. */
  if (calm || frugal) { showStill(); return; }

  video.muted = true;                        /* the property as well as the
                                                attribute, or some browsers
                                                refuse to autoplay */
  const candidates = (upright ? ["ram-hero-portrait.mp4"] : []).concat("ram-hero.mp4");

  const tryNext = i => {
    if (i >= candidates.length) return;      /* nothing there yet: the lotus stays */
    const name = candidates[i];

    const onError = () => { off(); tryNext(i + 1); };
    const onReady = () => { off(); start(name); };
    const off = () => {
      video.removeEventListener("error", onError);
      video.removeEventListener("loadeddata", onReady);
    };
    video.addEventListener("error", onError);
    video.addEventListener("loadeddata", onReady);

    /* preload is "none" in the markup so nothing downloads before this
       script has decided the visitor should get the film at all */
    video.preload = "auto";
    video.src = DIR + name;
    video.load();
  };

  const start = name => {
    hero.classList.toggle("film-portrait", name.includes("portrait"));
    exists(STILL).then(ok => { if (ok) video.poster = STILL; });

    video.play()
      .then(() => { reveal(false); keepInView(); })
      .catch(() => showStill());
  };

  /* Pause when nobody can see it: scrolled away, or the tab in the
     background. A film left running costs battery and data for nothing. */
  const keepInView = () => {
    let onScreen = true;
    const sync = () => {
      if (onScreen && !document.hidden) video.play().catch(() => {});
      else video.pause();
    };
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; sync(); })
        .observe(hero);
    }
    document.addEventListener("visibilitychange", sync);
  };

  tryNext(0);
})();
