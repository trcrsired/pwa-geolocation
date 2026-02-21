// -------------------------------
//  CONFIG
// -------------------------------
const CACHE_NAME = "pwa-geolocation-v15";

// Files to cache
const ASSETS = [
  "/",
  "/app.js",
  "/orientation.js",
  "/styles.css",
  "/manifest.json",
  "/sw-register.js",
  "/logo.webp",
  "/year.js",
];

// -------------------------------
//  INSTALL
// -------------------------------
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );

  // Activate immediately so we can check for updates
  self.skipWaiting();
});

// -------------------------------
//  ACTIVATE
// -------------------------------
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );

  // Become active immediately
  self.clients.claim();
});

// -------------------------------
//  FETCH
// -------------------------------
self.addEventListener("fetch", event => {
  const req = event.request;

  // Only handle GET
  if (req.method !== "GET") return;

  event.respondWith(
    caches.match(req).then(cached => {
      return (
        cached ||
        fetch(req).then(networkResp => {
          // Cache successful basic responses
          if (
            networkResp &&
            networkResp.status === 200 &&
            networkResp.type === "basic"
          ) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(req, networkResp.clone());
            });
          }
          return networkResp;
        })
      );
    })
  );
});

// -------------------------------
//  UPDATE NOTIFICATION
// -------------------------------
self.addEventListener("message", event => {
  if (event.data === "CHECK_FOR_UPDATE") {
    self.skipWaiting();
  }
});
