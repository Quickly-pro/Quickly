// Service Worker minimalista — solo para soporte offline básico
// Los assets JS/CSS NO se cachean aquí (Vercel CDN los gestiona)
// Esto evita que versiones antiguas se sirvan tras un deploy

const CACHE_NAME = 'quickly-shell-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Eliminar TODAS las cachés antiguas
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Estrategia: siempre red primero, sin cachear nada
// Así cada deploy se ve inmediatamente sin necesidad de limpiar caché
self.addEventListener('fetch', (event) => {
  // Solo interceptar navegaciones (no assets JS/CSS)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => fetch('/'))
    );
  }
  // Todo lo demás (JS, CSS, imágenes) va directo a la red sin pasar por SW
});
