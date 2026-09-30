/* ==========================================================================
   Hotel Perfect Plaza — Lord Ram & Mata Sita in the hero
   --------------------------------------------------------------------------
   Fades the picture in once it has actually loaded, and the gold lotus
   underneath steps aside. If it never loads, the figure is removed and the
   lotus stays. The picture itself is styled in site.css, "HERO PICTURE".
   ========================================================================== */

(function () {
  "use strict";

  const fig = document.querySelector("[data-figure]");
  if (!fig) return;
  const img = fig.querySelector("img");
  const scene = fig.closest("[data-scene]");

  const show = () => scene.classList.add("has-figure");
  const drop = () => fig.remove();

  if (img.complete) { if (img.naturalWidth) show(); else drop(); }
  else {
    img.addEventListener("load", show, { once: true });
    img.addEventListener("error", drop, { once: true });
  }
})();
