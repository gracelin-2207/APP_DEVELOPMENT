self.addEventListener('install', event => {
  event.waitUntil(
    caches.open('botanica-v1').then(cache => {
      return cache.addAll([
        '/',
        '/shan.html'
      ]);
    })
  );
});
