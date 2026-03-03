// =====================
// PWA INSTALLATION
// =====================
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

window.addEventListener('appinstalled', () => {
  document.getElementById('install-btn')?.classList.remove('show');
  showNotification('✅ Installed!', 'Malareey is now on your device.');
});

// =====================
// SERVICE WORKER
// =====================
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js')
    .catch(err => console.error('SW failed:', err));
}

// =====================
// ONLINE/OFFLINE
// =====================
window.addEventListener('offline', () => document.getElementById('offline-indicator')?.classList.add('show'));
window.addEventListener('online',  () => { document.getElementById('offline-indicator')?.classList.remove('show'); syncPendingData(); });
if (!navigator.onLine) document.getElementById('offline-indicator')?.classList.add('show');

// =====================
// NOTIFICATION HELPER
// =====================
function showNotification(title, message) {
  const n = document.createElement('div');
  n.style.cssText = 'position:fixed;top:100px;right:20px;background:#d4968d;color:white;padding:1rem 1.5rem;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.2);z-index:9999;max-width:300px;font-family:Poppins,sans-serif;';
  n.innerHTML = `<strong>${title}</strong><p style="margin-top:0.4rem;font-size:0.88rem;">${message}</p>`;
  document.body.appendChild(n);
  setTimeout(() => { n.style.transition = 'opacity 0.4s'; n.style.opacity = '0'; setTimeout(() => n.remove(), 400); }, 3500);
}

// =====================
// INDEXEDDB
// =====================
const DB_NAME = 'MalareeyDB';
const STORES = { contacts: 'contacts', syncQueue: 'syncQueue' };
let db;

function initDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('contacts'))  d.createObjectStore('contacts',  { keyPath: 'id', autoIncrement: true });
      if (!d.objectStoreNames.contains('syncQueue')) d.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
    };
  });
}

function saveToDB(storeName, data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readwrite');
    const req = tx.objectStore(storeName).add(data);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

function getFromDB(storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

function deleteFromDB(storeName, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readwrite');
    const req = tx.objectStore(storeName).delete(id);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

// =====================
// FORM HANDLING
// =====================
async function handleFormSubmit(e) {
  e.preventDefault();
  const formData = {
    name: e.target.querySelector('[name="name"]').value,
    email: e.target.querySelector('[name="email"]').value,
    message: e.target.querySelector('[name="message"]').value,
    timestamp: new Date().toISOString()
  };
  const status = document.getElementById('form-status');
  try {
    if (db) await saveToDB(STORES.contacts, formData);
    if (navigator.onLine) {
      const ok = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) }).then(r => r.ok).catch(() => false);
      status.className = 'form-status success';
      status.textContent = ok ? '✅ Message sent!' : "📝 Saved! Will send when online.";
      if (!ok && db) await saveToDB(STORES.syncQueue, { type: 'contact', data: formData });
    } else {
      if (db) await saveToDB(STORES.syncQueue, { type: 'contact', data: formData });
      status.className = 'form-status success';
      status.textContent = "📝 Saved! Will send when online.";
    }
    e.target.reset();
  } catch {
    status.className = 'form-status error';
    status.textContent = '❌ Error. Please try again.';
  }
  setTimeout(() => { status.className = 'form-status'; }, 3500);
}

async function syncPendingData() {
  if (!db) return;
  const queue = await getFromDB(STORES.syncQueue);
  for (const item of queue) {
    try {
      const ok = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item.data) }).then(r => r.ok).catch(() => false);
      if (ok) await deleteFromDB(STORES.syncQueue, item.id);
    } catch {}
  }
}

// ==============================================
// 🛒  CART
// ==============================================
let cart = [];

function cartFind(name)  { return cart.find(i => i.name === name); }
function cartTotal()     { return cart.reduce((s, i) => s + i.price * i.qty, 0); }
function cartCount()     { return cart.reduce((s, i) => s + i.qty, 0); }
function fmt(n)          { return '₹' + n.toLocaleString('en-IN'); }

// Badge
function refreshBadge() {
  const badge = document.getElementById('cart-count');
  if (!badge) return;
  badge.textContent = cartCount();
  badge.style.transform = 'scale(1.5)';
  setTimeout(() => badge.style.transform = '', 250);
}

// Toast
let _toastTimer;
function showToast(msg) {
  const t = document.getElementById('cart-toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

// Button state
function markButtonAdded(btn) {
  btn.textContent = '✅ Added';
  btn.style.background = '#9caf88';
}
function markButtonDefault(btn) {
  btn.textContent = '🛒 Add to Cart';
  btn.style.background = '';
}

// Sync ALL buttons to match current cart state
function syncAllButtons() {
  document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    cartFind(btn.dataset.name) ? markButtonAdded(btn) : markButtonDefault(btn);
  });
}

// Add item
function addItem(name, price, emoji) {
  const existing = cartFind(name);
  if (existing) { existing.qty++; } else { cart.push({ name, price, emoji, qty: 1 }); }
  refreshBadge();
  renderCart();
  showToast(emoji + ' ' + name + ' added!');
}

// Remove item
function removeItem(name) {
  cart = cart.filter(i => i.name !== name);
  refreshBadge();
  renderCart();
  syncAllButtons();
}

// Change quantity
function changeQty(name, delta) {
  const item = cartFind(name);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) { removeItem(name); return; }
  refreshBadge();
  renderCart();
}

// Render sidebar
function renderCart() {
  const list   = document.getElementById('cart-items-list');
  const empty  = document.getElementById('cart-empty');
  const footer = document.getElementById('cart-footer');
  const subEl  = document.getElementById('cart-subtotal-val');
  const totEl  = document.getElementById('cart-total-val');
  if (!list) return;

  if (cart.length === 0) {
    list.innerHTML = '';
    if (empty)  empty.style.display  = 'block';
    if (footer) footer.style.display = 'none';
    return;
  }

  if (empty)  empty.style.display  = 'none';
  if (footer) footer.style.display = 'block';

  list.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-img">${item.emoji}</div>
      <div class="cart-item-details">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">${fmt(item.price)} each</div>
        <div class="cart-item-controls">
          <button class="qty-btn" onclick="changeQty('${item.name}',-1)">−</button>
          <span class="qty-display">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty('${item.name}',1)">+</button>
          <span style="margin-left:.5rem;font-size:.8rem;color:#888">${fmt(item.price * item.qty)}</span>
        </div>
      </div>
      <button class="cart-item-remove" onclick="removeItem('${item.name}')">🗑</button>
    </div>
  `).join('');

  if (subEl) subEl.textContent = fmt(cartTotal());
  if (totEl) totEl.textContent = fmt(cartTotal());
}

// Open / close sidebar
function openCart() {
  document.getElementById('cart-sidebar')?.classList.add('open');
  document.getElementById('cart-overlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeCart() {
  document.getElementById('cart-sidebar')?.classList.remove('open');
  document.getElementById('cart-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

// Checkout
function handleCheckout() {
  if (cart.length === 0) return;
  const count = cartCount(), total = cartTotal();
  const summary = document.getElementById('checkout-summary-text');
  if (summary) summary.textContent = `${count} item${count > 1 ? 's' : ''} for ${fmt(total)}. Your flowers will be delivered soon! 🌸`;
  document.getElementById('checkout-modal')?.classList.add('show');
  cart = [];
  refreshBadge();
  renderCart();
  syncAllButtons();
  closeCart();
}

// =====================
// BOOT
// =====================
document.addEventListener('DOMContentLoaded', async () => {

  // DB init
  try { await initDB(); } catch (e) { console.warn('DB unavailable', e); }

  // Form
  document.getElementById('contact-form')?.addEventListener('submit', handleFormSubmit);

  // Notification permission
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();

  // Install button
  const installBtn = document.getElementById('install-btn');
  if (installBtn) {
    installBtn.classList.add('show');
    installBtn.addEventListener('click', () => document.getElementById('install-modal')?.classList.add('show'));
  }
  document.getElementById('confirm-install')?.addEventListener('click', async () => {
    if (deferredPrompt) { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; }
    document.getElementById('install-modal')?.classList.remove('show');
  });
  document.getElementById('cancel-install')?.addEventListener('click', () => {
    document.getElementById('install-modal')?.classList.remove('show');
  });

  // Cart wiring
  refreshBadge();
  renderCart();

  document.getElementById('cart-toggle-btn')?.addEventListener('click', openCart);
  document.getElementById('cart-close-btn')?.addEventListener('click', closeCart);
  document.getElementById('cart-overlay')?.addEventListener('click', closeCart);
  document.getElementById('continue-shopping-btn')?.addEventListener('click', closeCart);
  document.getElementById('checkout-btn')?.addEventListener('click', handleCheckout);
  document.getElementById('checkout-close-btn')?.addEventListener('click', () => {
    document.getElementById('checkout-modal')?.classList.remove('show');
  });
  document.getElementById('checkout-modal')?.addEventListener('click', function(e) {
    if (e.target === this) this.classList.remove('show');
  });

  // ── ADD TO CART TOGGLE BUTTONS ──
  document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const name  = this.dataset.name;
      const price = parseInt(this.dataset.price, 10);
      const emoji = this.dataset.emoji;

      if (cartFind(name)) {
        // Already in cart → REMOVE + reset button
        removeItem(name);
      } else {
        // Not in cart → ADD + mark button green
        addItem(name, price, emoji);
        markButtonAdded(this);
      }
    });
  });

});

console.log('🌸 Malareey PWA v2.1 ready');
