// =====================
// PWA INSTALLATION
// =====================
let deferredPrompt;

// Show install button immediately (fallback)
document.addEventListener('DOMContentLoaded', () => {
  const installBtn = document.getElementById('install-btn');
  if (installBtn) {
    installBtn.classList.add('show');
    console.log('✅ Install button visible');
  }
});

// Listen for beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  console.log('✅ beforeinstallprompt triggered');
});

// Install button click
document.addEventListener('DOMContentLoaded', () => {
  const installBtn = document.getElementById('install-btn');
  if (installBtn) {
    installBtn.addEventListener('click', () => {
      const modal = document.getElementById('install-modal');
      if (modal) {
        modal.classList.add('show');
      }
    });
  }
});

// Confirm install
document.addEventListener('DOMContentLoaded', () => {
  const confirmBtn = document.getElementById('confirm-install');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`Install outcome: ${outcome}`);
        
        if (outcome === 'accepted') {
          showNotification('✅ Installing...', 'Malareey is being installed on your device!');
        }
        
        deferredPrompt = null;
        document.getElementById('install-modal').classList.remove('show');
        document.getElementById('install-btn').classList.remove('show');
      }
    });
  }
});

// Cancel install
document.addEventListener('DOMContentLoaded', () => {
  const cancelBtn = document.getElementById('cancel-install');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      const modal = document.getElementById('install-modal');
      if (modal) {
        modal.classList.remove('show');
      }
    });
  }
});

// App installed event
window.addEventListener('appinstalled', () => {
  console.log('✅ App installed successfully!');
  const installBtn = document.getElementById('install-btn');
  if (installBtn) {
    installBtn.classList.remove('show');
  }
  showNotification('✅ Success!', 'Malareey installed. You can now use it offline!');
});

// =====================
// SERVICE WORKER REGISTRATION
// =====================
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js')
    .then(reg => {
      console.log('✅ Service Worker registered successfully');
      checkForUpdates(reg);
    })
    .catch(err => console.error('❌ Service Worker registration failed:', err));
}

function checkForUpdates(reg) {
  setInterval(() => {
    reg.update();
  }, 60000);
}

// =====================
// ONLINE/OFFLINE STATUS
// =====================
const offlineIndicator = document.getElementById('offline-indicator');

window.addEventListener('offline', () => {
  if (offlineIndicator) {
    offlineIndicator.classList.add('show');
  }
  console.log('🔴 Went offline');
});

window.addEventListener('online', () => {
  if (offlineIndicator) {
    offlineIndicator.classList.remove('show');
  }
  console.log('🟢 Back online');
  syncPendingData();
});

// Check initial status
if (!navigator.onLine && offlineIndicator) {
  offlineIndicator.classList.add('show');
}

// =====================
// NOTIFICATION SYSTEM
// =====================
function showNotification(title, message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 100px;
    right: 20px;
    background: #d4968d;
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    z-index: 2000;
    animation: slideIn 0.3s ease-in-out;
    max-width: 300px;
  `;
  notification.innerHTML = `<strong>${title}</strong><p style="margin-top:0.5rem;font-size:0.9rem;">${message}</p>`;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-in-out';
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

// =====================
// INDEXEDDB SETUP
// =====================
const DB_NAME = 'MalareeyDB';
const DB_VERSION = 1;
const STORES = {
  bouquets: 'bouquets',
  orders: 'orders',
  syncQueue: 'syncQueue',
  contacts: 'contacts'
};

let db;

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      console.error('❌ Database error:', request.error);
      reject(request.error);
    };
    
    request.onsuccess = () => {
      db = request.result;
      console.log('✅ Database initialized');
      resolve(db);
    };
    
    request.onupgradeneeded = (e) => {
      db = e.target.result;
      
      if (!db.objectStoreNames.contains(STORES.bouquets)) {
        const bouquetsStore = db.createObjectStore(STORES.bouquets, { keyPath: 'id' });
        bouquetsStore.createIndex('category', 'category', { unique: false });
      }
      
      if (!db.objectStoreNames.contains(STORES.orders)) {
        db.createObjectStore(STORES.orders, { keyPath: 'id', autoIncrement: true });
      }
      
      if (!db.objectStoreNames.contains(STORES.syncQueue)) {
        db.createObjectStore(STORES.syncQueue, { keyPath: 'id', autoIncrement: true });
      }
      
      if (!db.objectStoreNames.contains(STORES.contacts)) {
        db.createObjectStore(STORES.contacts, { keyPath: 'id', autoIncrement: true });
      }
      
      console.log('✅ Database schema created');
    };
  });
}

// Save data to IndexedDB
function saveToDB(storeName, data) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }
    
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.add(data);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      console.log(`✅ Data saved to ${storeName}`);
      resolve(request.result);
    };
  });
}

// Get all data from IndexedDB
function getFromDB(storeName) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }
    
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// Delete from IndexedDB
function deleteFromDB(storeName, id) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }
    
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// =====================
// FORM HANDLING
// =====================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initDB();
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }
  
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', handleFormSubmit);
  }
  
  requestNotificationPermission();
});

async function handleFormSubmit(e) {
  e.preventDefault();
  
  const formData = {
    name: e.target.querySelector('input[name="name"]').value,
    email: e.target.querySelector('input[name="email"]').value,
    message: e.target.querySelector('textarea[name="message"]').value,
    timestamp: new Date().toISOString(),
    submitted: false
  };
  
  const statusDiv = document.getElementById('form-status');
  
  try {
    await saveToDB(STORES.contacts, formData);
    
    if (navigator.onLine) {
      const success = await submitFormOnline(formData);
      if (success) {
        statusDiv.className = 'form-status success';
        statusDiv.textContent = '✅ Message sent successfully!';
        e.target.reset();
        console.log('✅ Form submitted online');
      } else {
        throw new Error('Server error');
      }
    } else {
      await saveToDB(STORES.syncQueue, {
        type: 'form_submission',
        data: formData
      });
      
      statusDiv.className = 'form-status success';
      statusDiv.textContent = '📝 Message saved! Will be sent when you\'re back online.';
      e.target.reset();
      console.log('✅ Form saved for offline sync');
    }
    
    setTimeout(() => {
      statusDiv.className = 'form-status';
    }, 3000);
    
  } catch (error) {
    console.error('Form error:', error);
    statusDiv.className = 'form-status error';
    statusDiv.textContent = '❌ Error processing your message. Please try again.';
    
    setTimeout(() => {
      statusDiv.className = 'form-status';
    }, 3000);
  }
}

// Submit form to server
async function submitFormOnline(formData) {
  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });
    
    if (response.ok) {
      showNotification('✅ Success!', 'Your message has been sent.');
      return true;
    } else {
      console.error('Server responded with:', response.status);
      return false;
    }
  } catch (error) {
    console.error('Form submission error:', error);
    return false;
  }
}

// Sync pending data when back online
async function syncPendingData() {
  try {
    const syncQueue = await getFromDB(STORES.syncQueue);
    
    if (syncQueue.length === 0) {
      console.log('✅ No pending data to sync');
      return;
    }
    
    console.log(`🔄 Syncing ${syncQueue.length} items...`);
    
    for (const item of syncQueue) {
      try {
        if (item.type === 'form_submission') {
          const success = await submitFormOnline(item.data);
          if (success) {
            await deleteFromDB(STORES.syncQueue, item.id);
            console.log(`✅ Synced item ${item.id}`);
          }
        }
      } catch (error) {
        console.error(`❌ Sync failed for item ${item.id}:`, error);
      }
    }
    
    const remaining = await getFromDB(STORES.syncQueue);
    if (remaining.length === 0) {
      showNotification('🔄 Sync Complete', 'All pending messages have been sent!');
    }
    
  } catch (error) {
    console.error('Sync error:', error);
  }
}

// =====================
// NOTIFICATION PERMISSION
// =====================
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        console.log('✅ Notification permission granted');
      }
    });
  }
}

// =====================
// PERFORMANCE & DEBUGGING
// =====================
window.addEventListener('load', () => {
  const perfData = window.performance.timing;
  const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
  console.log(`⚡ Page loaded in ${pageLoadTime}ms`);
});

console.log('🌸 Malareey PWA v1.0 - Ready for offline use!');