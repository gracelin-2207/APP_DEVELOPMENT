const CACHE_NAME = 'malareey-v1';
const RUNTIME_CACHE = 'malareey-runtime-v1';
const IMAGE_CACHE = 'malareey-images-v1';

const urlsToCache = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap',
];

// Install Event
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('✅ Caching core assets');
        return cache.addAll(urlsToCache).catch(err => {
          console.warn('⚠️ Some assets failed to cache:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && 
              cacheName !== RUNTIME_CACHE && 
              cacheName !== IMAGE_CACHE) {
            console.log(`🗑️ Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Smart Caching Strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }
  
  // Skip chrome extensions and invalid protocols
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }
  
  // API requests - Network First with timeout
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }
  
  // Images - Cache First
  if (request.destination === 'image') {
    event.respondWith(imageCacheStrategy(request));
    return;
  }
  
  // CSS, JS, Fonts - Cache First
  if (request.destination === 'style' || 
      request.destination === 'script' || 
      request.destination === 'font') {
    event.respondWith(cacheFistStrategy(request));
    return;
  }
  
  // HTML Documents - Network First
  if (request.destination === 'document') {
    event.respondWith(networkFirstStrategy(request));
    return;
  }
  
  // Default - Network First
  event.respondWith(networkFirstStrategy(request));
});

// Network First Strategy with Timeout
function networkFirstStrategy(request) {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      caches.match(request)
        .then(response => {
          resolve(response || createOfflineResponse());
        });
    }, 5000); // 5 second timeout
    
    fetch(request)
      .then((response) => {
        clearTimeout(timeoutId);
        
        if (!response || response.status !== 200 || response.type === 'error') {
          resolve(response);
          return;
        }
        
        const responseClone = response.clone();
        caches.open(RUNTIME_CACHE)
          .then((cache) => {
            cache.put(request, responseClone);
          });
        
        resolve(response);
      })
      .catch(() => {
        clearTimeout(timeoutId);
        caches.match(request)
          .then(response => {
            resolve(response || createOfflineResponse());
          });
      });
  });
}

// Cache First Strategy
function cacheFistStrategy(request) {
  return caches.match(request)
    .then((response) => {
      if (response) {
        return response;
      }
      
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }
        
        const responseClone = response.clone();
        caches.open(RUNTIME_CACHE)
          .then((cache) => {
            cache.put(request, responseClone);
          });
        
        return response;
      });
    })
    .catch(() => createOfflineResponse());
}

// Image Cache Strategy with Size Limit
function imageCacheStrategy(request) {
  return caches.open(IMAGE_CACHE)
    .then((cache) => {
      return cache.match(request)
        .then((response) => {
          if (response) {
            return response;
          }
          
          return fetch(request).then((response) => {
            if (!response || response.status !== 200) {
              return response;
            }
            
            const responseClone = response.clone();
            
            // Limit cache size
            cache.keys().then((keys) => {
              if (keys.length > 50) {
                cache.delete(keys[0]);
              }
            });
            
            cache.put(request, responseClone);
            return response;
          });
        });
    })
    .catch(() => {
      // Return placeholder image
      return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect fill="#e5d0bf" width="200" height="200"/><text x="100" y="100" text-anchor="middle" dy=".3em" fill="#d4968d">🌸</text></svg>',
        {
          headers: { 'Content-Type': 'image/svg+xml' }
        }
      );
    });
}

// Create offline response
function createOfflineResponse() {
  return new Response(
    JSON.stringify({
      error: 'You are offline',
      message: 'This content is not available offline. Please check your connection.'
    }),
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'application/json'
      })
    }
  );
}

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('✅ Progressive Service Worker loaded');
