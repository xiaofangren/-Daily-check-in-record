const DB_NAME = 'DailyCheckinDB';
const DB_VERSION = 1;
let db = null;

function openDB(retries = 3) {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      if (!database.objectStoreNames.contains('items')) {
        const itemStore = database.createObjectStore('items', {
          keyPath: 'id',
          autoIncrement: true
        });
        itemStore.createIndex('name', 'name', { unique: false });
      }

      if (!database.objectStoreNames.contains('records')) {
        const recordStore = database.createObjectStore('records', {
          keyPath: 'id',
          autoIncrement: true
        });
        recordStore.createIndex('itemId', 'itemId', { unique: false });
        recordStore.createIndex('date', 'date', { unique: false });
        recordStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;

      db.onerror = (e) => {
        console.error('IndexedDB error:', e.target.error);
      };

      resolve(db);
    };

    request.onerror = (event) => {
      console.error('IndexedDB open error:', event.target.error);
      if (retries > 0) {
        console.log(`Retrying IndexedDB open... (${retries} left)`);
        setTimeout(() => {
          openDB(retries - 1).then(resolve).catch(reject);
        }, 300);
      } else {
        reject(event.target.error);
      }
    };

    request.onblocked = () => {
      console.warn('IndexedDB open blocked');
    };
  });
}

async function initDB() {
  try {
    await openDB();
    console.log('IndexedDB initialized');
    return true;
  } catch (e) {
    console.error('Failed to initialize IndexedDB:', e);
    return false;
  }
}

function runTransaction(storeName, mode, callback) {
  return new Promise(async (resolve, reject) => {
    try {
      const database = await openDB();
      const tx = database.transaction(storeName, mode);
      const store = tx.objectStore(storeName);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);

      const result = callback(store);
      if (result && result.onsuccess !== undefined) {
        result.onsuccess = (e) => resolve(e.target.result);
        result.onerror = (e) => reject(e.target.error);
      }
    } catch (e) {
      reject(e);
    }
  });
}

async function addItem(item) {
  return runTransaction('items', 'readwrite', (store) => {
    return store.add({
      name: item.name,
      icon: item.icon || '📌',
      color: item.color || '#4A90D9',
      createdAt: Date.now()
    });
  });
}

async function updateItem(item) {
  return runTransaction('items', 'readwrite', (store) => {
    return store.put(item);
  });
}

async function deleteItem(id) {
  await runTransaction('records', 'readwrite', (store) => {
    const index = store.index('itemId');
    const request = index.openCursor(IDBKeyRange.only(id));
    request.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
  });

  return runTransaction('items', 'readwrite', (store) => {
    return store.delete(id);
  });
}

async function getAllItems() {
  return new Promise(async (resolve, reject) => {
    try {
      const database = await openDB();
      const tx = database.transaction('items', 'readonly');
      const store = tx.objectStore('items');
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };
      request.onerror = () => reject(request.error);
    } catch (e) {
      reject(e);
    }
  });
}

async function getItemById(id) {
  return new Promise(async (resolve, reject) => {
    try {
      const database = await openDB();
      const tx = database.transaction('items', 'readonly');
      const store = tx.objectStore('items');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } catch (e) {
      reject(e);
    }
  });
}

async function getItemByName(name) {
  return new Promise(async (resolve, reject) => {
    try {
      const database = await openDB();
      const tx = database.transaction('items', 'readonly');
      const store = tx.objectStore('items');
      const request = store.getAll();

      request.onsuccess = () => {
        const items = request.result || [];
        const found = items.find(item => item.name === name);
        resolve(found || null);
      };
      request.onerror = () => reject(request.error);
    } catch (e) {
      reject(e);
    }
  });
}

async function checkin(itemId, customDate) {
  const now = customDate ? new Date(customDate + 'T12:00:00') : new Date();
  const dateStr = customDate || formatDate(new Date());

  return runTransaction('records', 'readwrite', (store) => {
    return store.add({
      itemId: itemId,
      timestamp: now.getTime(),
      date: dateStr
    });
  });
}

async function undoCheckin(itemId) {
  const today = formatDate(new Date());

  return new Promise(async (resolve, reject) => {
    try {
      const database = await openDB();
      const tx = database.transaction('records', 'readwrite');
      const store = tx.objectStore('records');
      const index = store.index('itemId');
      const request = index.openCursor(IDBKeyRange.only(itemId));

      request.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          if (cursor.value.date === today) {
            cursor.delete();
          }
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch (e) {
      reject(e);
    }
  });
}

async function getRecordsByDate(date) {
  return new Promise(async (resolve, reject) => {
    try {
      const database = await openDB();
      const tx = database.transaction('records', 'readonly');
      const store = tx.objectStore('records');
      const index = store.index('date');
      const request = index.getAll(IDBKeyRange.only(date));

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    } catch (e) {
      reject(e);
    }
  });
}

async function getRecordsByItem(itemId) {
  return new Promise(async (resolve, reject) => {
    try {
      const database = await openDB();
      const tx = database.transaction('records', 'readonly');
      const store = tx.objectStore('records');
      const index = store.index('itemId');
      const request = index.getAll(IDBKeyRange.only(itemId));

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    } catch (e) {
      reject(e);
    }
  });
}

async function getRecordsByDateRange(startDate, endDate) {
  return new Promise(async (resolve, reject) => {
    try {
      const database = await openDB();
      const tx = database.transaction('records', 'readonly');
      const store = tx.objectStore('records');
      const index = store.index('date');
      const range = IDBKeyRange.bound(startDate, endDate);
      const request = index.getAll(range);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    } catch (e) {
      reject(e);
    }
  });
}

async function getTodayRecords() {
  return getRecordsByDate(formatDate(new Date()));
}

async function getItemRecordsByDateRange(itemId, startDate, endDate) {
  const records = await getRecordsByDateRange(startDate, endDate);
  return records.filter(r => r.itemId === itemId);
}

async function deleteRecord(id) {
  return runTransaction('records', 'readwrite', (store) => {
    return store.delete(id);
  });
}

async function exportAllRecords() {
  const items = await getAllItems();
  const itemMap = {};
  items.forEach(item => {
    itemMap[item.id] = item;
  });

  return new Promise(async (resolve, reject) => {
    try {
      const database = await openDB();
      const tx = database.transaction('records', 'readonly');
      const store = tx.objectStore('records');
      const request = store.getAll();

      request.onsuccess = () => {
        const records = request.result || [];
        const enriched = records.map(r => ({
          ...r,
          itemName: itemMap[r.itemId]?.name || '未知项目',
          itemIcon: itemMap[r.itemId]?.icon || '📌'
        }));
        resolve({ items, records: enriched });
      };
      request.onerror = () => reject(request.error);
    } catch (e) {
      reject(e);
    }
  });
}

async function clearAllData() {
  await runTransaction('records', 'readwrite', (store) => {
    store.clear();
  });
  await runTransaction('items', 'readwrite', (store) => {
    store.clear();
  });
}

async function getStorageEstimate() {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const est = await navigator.storage.estimate();
      return {
        usage: est.usage || 0,
        quota: est.quota || 0,
        percentUsed: est.quota ? ((est.usage / est.quota) * 100).toFixed(1) : 0
      };
    } catch (e) {
      return null;
    }
  }
  return null;
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatTime(timestamp) {
  const d = new Date(timestamp);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatDisplayDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  return `${d.getMonth() + 1}月${d.getDate()}日 周${weekDays[d.getDay()]}`;
}
