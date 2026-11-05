/* The staff register's service worker: what makes attendance.html an app
   that can be put on a phone's home screen, and open without internet.

   The page itself (html, css, js, icons) comes from the network every time
   when there is one, so a new version shows at once; a copy is kept for when
   there isn't. The data (/api/…) is never kept: without internet the page
   opens and says it can't reach the hotel's system.

   It also shows the app's notifications (api/_lib/push.js): someone has
   punched. Tapping one opens the app on Today. */

const CACHE = "hpp-register-v3";
const SHELL = ["/attendance.html", "/assets/css/attendance.css", "/assets/js/attendance.js",
  "/assets/icons/register.svg", "/assets/icons/register-192.png", "/attendance.webmanifest",
  "/assets/images/hotel-logo.png", "/assets/images/front-desk.jpg"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("push", e => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch (err) { m = { title: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(m.title || "Staff register", {
    body: m.body || "", icon: "/assets/icons/register-192.png", badge: "/assets/icons/register-192.png",
    lang: /[ऀ-ॿ]/.test(m.title || "") ? "ne" : "en", timestamp: Date.now(), data: { url: "/attendance.html#day" }
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    /* the app already open: bring it forward (it refreshes Today by itself) */
    const open = list.find(c => new URL(c.url).pathname.startsWith("/attendance"));
    return open ? open.focus() : self.clients.openWindow("/attendance.html#day");
  }));
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  e.respondWith(fetch(e.request).then(res => {
    if (res.ok && SHELL.includes(url.pathname)) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(url.pathname, copy)); }
    return res;
  }).catch(() => caches.match(url.pathname).then(hit => hit || caches.match("/attendance.html"))));
});
