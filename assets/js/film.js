/* ==========================================================================
   Hotel Perfect Plaza — the hero film and the hotel tour
   --------------------------------------------------------------------------
   Three videos, all the hotel's own:

     assets/video/hotel-hero.mp4          12.6 s silent loop behind the hero
     assets/video/hotel-tour.mp4          the full 73 s promo film, with music
     assets/video/hotel-tour-poster.jpg   the tour's cover frame
     assets/video/hotel-welcome.mp4       the presenter's 64 s walk through
                                          the hotel, in "About the hotel"
     assets/video/hotel-welcome-poster.jpg  its cover frame

   THE HERO LOOP
     • most visitors             the loop, faded in over the lobby photograph
                                 (behind the glass frame on wide screens, in
                                 the band at the top of the frame on phones)
     • "reduce motion" / data    no download at all — the photograph stays,
       saver / a 2G connection   and it is already the right picture (on
                                 phones, the band keeps the film's cover)
     • autoplay refused          the same (an iPhone in Low Power Mode
                                 refuses to autoplay even muted video)
   It pauses whenever it is scrolled away, the tab is hidden, or the tour
   is open.

   THE TOUR
   "Watch the hotel tour" opens the full film in a dialog, with sound — a
   click is what lets a browser play sound. Nothing downloads until then.
   Without script, the same link simply opens the video file.
   ========================================================================== */

(function () {
  "use strict";

  const hero = document.querySelector(".hero");
  const heroVideo = document.querySelector("[data-film] video");
  let tourOpen = false;
  let heroPlaying = false;       /* set once the loop has actually started */
  let heroOnScreen = true;

  const syncHero = () => {
    if (!heroPlaying) return;
    if (heroOnScreen && !document.hidden && !tourOpen) heroVideo.play().catch(() => {});
    else heroVideo.pause();
  };

  /* ----------------------------------------------------------- the loop */

  (function startLoop() {
    if (!hero || !heroVideo) return;

    const calm   = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const net    = navigator.connection || {};
    const frugal = !!net.saveData || /(^|-)2g$/.test(net.effectiveType || "");
    /* The photograph is already in place; these visitors keep it and never
       download the few megabytes of film. */
    if (calm || frugal) return;

    heroVideo.muted = true;          /* the property as well as the attribute,
                                        or some browsers refuse to autoplay */
    const onReady = () => {
      heroVideo.removeEventListener("loadeddata", onReady);
      heroVideo.play()
        .then(() => {
          heroPlaying = true;
          hero.classList.add("has-film");
          /* on <html> too, for the header, which sits outside the hero */
          document.documentElement.classList.add("film-on");
          /* Watch the film's own box: the whole hero on wide screens, only
             the band on phones — where the hero runs on long after the
             band has scrolled away. */
          if ("IntersectionObserver" in window) {
            new IntersectionObserver(([entry]) => { heroOnScreen = entry.isIntersecting; syncHero(); })
              .observe(heroVideo.parentElement);
          }
          document.addEventListener("visibilitychange", syncHero);
        })
        .catch(() => { /* autoplay refused: the photograph stays */ });
    };
    heroVideo.addEventListener("loadeddata", onReady);
    /* preload is "none" in the markup, so nothing downloads before this
       script has decided the visitor should get the film at all */
    heroVideo.preload = "auto";
    heroVideo.src = heroVideo.dataset.src;
    heroVideo.load();
  })();

  /* --------------------------------------------------- the welcome film
     The presenter's walk through the hotel, in "About the hotel". Tapping
     the cover swaps it for the video and plays it, with sound — the tap is
     what lets a browser play sound. Nothing downloads before the tap.    */

  document.querySelectorAll("[data-inline-film]").forEach(frame => {
    const video = frame.querySelector("video");
    const play = frame.querySelector("[data-inline-play]");
    if (!video || !play) return;
    play.addEventListener("click", e => {
      e.preventDefault();
      if (!video.getAttribute("src")) { video.preload = "auto"; video.src = video.dataset.src; }
      frame.classList.add("is-playing");
      video.focus({ preventScroll: true });
      video.play().catch(() => { /* the controls are there to press play */ });
    });
  });

  /* ----------------------------------------------------------- the tour */

  (function wireTour() {
    const dialog = document.querySelector("[data-tour]");
    const opens = document.querySelectorAll("[data-tour-open]");
    if (!dialog || !opens.length || typeof dialog.showModal !== "function") return;
    const video = dialog.querySelector("video");
    let opener = null;

    opens.forEach(link => link.addEventListener("click", e => {
      e.preventDefault();
      opener = link;
      if (!video.getAttribute("src")) {
        /* load now, whatever happens to play(): if a browser refuses to
           start it with sound, the guest still gets a ready player with its
           first frame and length, rather than a blank box */
        video.preload = "auto";
        video.src = video.dataset.src;
      }
      tourOpen = true;
      syncHero();
      /* one film with sound at a time */
      document.querySelectorAll("[data-inline-film] video").forEach(v => v.pause());
      document.documentElement.classList.add("tour-open");
      dialog.showModal();
      video.play().catch(() => { /* the controls are there to press play */ });
    }));

    dialog.querySelectorAll("[data-tour-close]").forEach(b =>
      b.addEventListener("click", () => dialog.close()));
    /* a click on the dimmed backdrop — the dialog itself, not its contents */
    dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });

    dialog.addEventListener("close", () => {
      video.pause();
      tourOpen = false;
      document.documentElement.classList.remove("tour-open");
      syncHero();
      if (opener) opener.focus();
    });
  })();
})();
