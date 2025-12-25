const CACHE_NAME = "ram-atama-v1";

// Assets to cache on install
const STATIC_ASSETS = [
    "/",
    "/icon.svg",
    "/manifest.webmanifest",
];

// Install event
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate event
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// Fetch event
self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== "GET") return;

    // Skip API requests
    if (url.pathname.startsWith("/api/")) return;

    // For navigation requests
    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                    return response;
                })
                .catch(() => {
                    return caches.match(request).then((cached) => {
                        return cached || new Response("Çevrimdışısınız", {
                            status: 503,
                            headers: { "Content-Type": "text/html; charset=utf-8" },
                        });
                    });
                })
        );
        return;
    }

    // For static assets
    if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff|woff2)$/)) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;
                return fetch(request).then((response) => {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                    return response;
                });
            })
        );
    }
});

// Push notifications
self.addEventListener("push", (event) => {
    const data = event.data?.json() || {};
    const title = data.title || "RAM Atama";
    const options = {
        body: data.body || "Yeni bildirim",
        icon: "/icon.svg",
        badge: "/icon.svg",
        data: data.url || "/",
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click
self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = event.notification.data || "/";
    event.waitUntil(
        self.clients.matchAll({ type: "window" }).then((clients) => {
            for (const client of clients) {
                if (client.url === url && "focus" in client) {
                    return client.focus();
                }
            }
            return self.clients.openWindow(url);
        })
    );
});
