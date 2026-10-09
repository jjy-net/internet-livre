/* JJY · Service Worker — funcionamento 100% offline
 *
 * No build (npm run build) o plugin "jjy-offline-precache" do vite.config.js:
 *   - grava precache-manifest.json com TODOS os arquivos gerados
 *   - troca __BUILD_ID__ abaixo por um identificador único do build
 * Na instalação este SW baixa a lista inteira, então todas as telas abrem
 * sem rede, mesmo as que nunca foram visitadas.
 */
const BUILD_ID = '__BUILD_ID__';
const CACHE = 'jjy-app-' + BUILD_ID;
const CORE = ['./', './index.html', './manifest.json', './icon.svg'];

async function precache() {
  const cache = await caches.open(CACHE);
  let files = CORE;
  try {
    const res = await fetch('./precache-manifest.json', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.files)) files = [...new Set([...CORE, ...data.files])];
    }
  } catch {
    /* modo dev ou sem manifesto: fica só o núcleo + cache sob demanda */
  }
  // Um arquivo com falha não pode impedir a instalação do restante
  await Promise.allSettled(
    files.map(async (url) => {
      const res = await fetch(url, { cache: 'reload' });
      if (res.ok) await cache.put(url, res);
    })
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

function networkWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(request).then(
      (res) => { clearTimeout(timer); resolve(res); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

async function store(request, response) {
  if (response && response.status === 200 && response.type === 'basic') {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Fora do escopo do cache: escrita, API, WebSocket, outras origens e streaming parcial (vídeo)
  if (
    req.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.includes('/api/') ||
    req.headers.has('range')
  ) {
    return;
  }

  // Páginas: rede primeiro (pega versão nova quando há rede), cache se cair ou demorar
  if (req.mode === 'navigate') {
    event.respondWith(
      networkWithTimeout(req, 3000)
        .then((res) => store(req, res))
        .catch(async () =>
          (await caches.match(req, { ignoreSearch: true })) ||
          (await caches.match('./index.html')) ||
          Response.error()
        )
    );
    return;
  }

  // Arquivos com hash no nome nunca mudam: cache direto
  if (url.pathname.includes('/assets/')) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => store(req, res))));
    return;
  }

  // Demais arquivos: responde do cache na hora e atualiza em segundo plano
  event.respondWith(
    caches.match(req).then((hit) => {
      const fresh = fetch(req).then((res) => store(req, res));
      if (hit) {
        event.waitUntil(fresh.catch(() => undefined));
        return hit;
      }
      return fresh;
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

