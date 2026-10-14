const CACHE_NAME = 'captains-chair-v2-cache';
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json'
];

// Install Event: Cache files
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

// Fetch Event: Serve from cache, fallback to network
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) return response;
                return fetch(event.request);
            })
    );
});
