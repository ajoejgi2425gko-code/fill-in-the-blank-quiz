const CACHE_NAME = 'anaume-quiz-v2';
const SHARE_CACHE = 'anaume-quiz-share-v1';
const BASE_URL = new URL('./', self.location.href);
const SHARE_DATA_URL = new URL('./__shared_data__', BASE_URL).href;
const APP_SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'].map(path => new URL(path, BASE_URL).href);

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME && key !== SHARE_CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Web Share Target: Keep などから POST された内容を Cache Storage に一時保存
  if (request.method === 'POST' && url.pathname.endsWith('/share/')) {
    event.respondWith((async () => {
      const formData = await request.formData();
      const payload = {
        title: String(formData.get('title') || ''),
        text: String(formData.get('text') || ''),
        url: String(formData.get('url') || '')
      };
      const cache = await caches.open(SHARE_CACHE);
      await cache.put(SHARE_DATA_URL, new Response(JSON.stringify(payload), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      }));
      return Response.redirect(BASE_URL.href, 303);
    })());
    return;
  }

  if (request.method !== 'GET') return;

  if (url.href === SHARE_DATA_URL) {
    event.respondWith((async () => {
      const cache = await caches.open(SHARE_CACHE);
      return await cache.match(SHARE_DATA_URL) || new Response('共有データはありません', { status: 404 });
    })());
    return;
  }

  event.respondWith(
    fetch(request).then(response => {
      if (response && response.ok && request.method === 'GET' && APP_SHELL.includes(url.href)) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    }).catch(() => caches.match(request).then(response => response || caches.match(new URL('./index.html', BASE_URL).href)))
  );
});
