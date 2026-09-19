const CACHE = 'sodruzhestvo-static-v4';
const STATIC = [
  '/site/css/admin.min.css',
  '/site/scripts/admin/login.js',
  '/site/scripts/admin/control.js',
  '/site/img/pwa-192.png',
  '/site/img/pwa-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(STATIC))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith('/site/')) return;

  const isAdminAsset = url.pathname.startsWith('/site/css/admin') || url.pathname.startsWith('/site/scripts/admin/');

  if (isAdminAsset) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (!response.ok) return response;
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      return response;
    }))
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  event.waitUntil(
  self.registration.showNotification(data.title || 'Содружество Control', {
    body: data.body || 'Новое напоминание',
    icon: '/site/img/pwa-192.png',
    badge: '/site/img/pwa-192.png',

    requireInteraction: true,
    tag: data.tag || 'sodruzhestvo-control',
    renotify: true,

    data: {
      url: data.url || '/admin/dashboard'
    }
  })
);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/admin/dashboard';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((client) => client.url.includes('/admin/'));
      if (existing) {
        existing.navigate(target);
        return existing.focus();
      }
      return clients.openWindow(target);
    })
  );
});
