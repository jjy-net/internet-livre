const CACHE_NAME = 'jjy-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache aberto');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Ignora requisições POST/PUT/DELETE e rotas dinâmicas de API ou WebSocket
  if (event.request.method !== 'GET' || event.request.url.includes('/api/') || event.request.url.startsWith('ws')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request).then(
          (response) => {
            // Check if valid response
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Suporte a Notificações em Segundo Plano & Push do Administrador
self.addEventListener('push', (event) => {
  let data = { title: '🚨 ALERTA DA ADMINISTRAÇÃO', body: 'Mensagem urgente da Central.' };
  try {
    if (event.data) data = event.data.json();
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title || '🚨 ALERTA DO ADMINISTRADOR', {
      body: data.body || data.text || 'Atenção necessária',
      icon: '/icon.svg',
      badge: '/icon.svg',
      vibrate: [400, 200, 400, 200, 400],
      requireInteraction: true,
      tag: 'admin-alert-' + Date.now(),
      renotify: true,
      data: data,
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag } = event.data;
    event.waitUntil(
      self.registration.showNotification(title || '🚨 ALERTA DO ADMINISTRADOR', {
        body: body || '',
        icon: '/icon.svg',
        badge: '/icon.svg',
        vibrate: [400, 200, 400, 200, 400],
        requireInteraction: true,
        tag: tag || 'admin-msg-' + Date.now(),
        renotify: true,
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});

