const ACCT_DB_NAME = 'AccountingDB';
const ACCT_DB_VERSION = 1;
let acctDb = null;

function openAcctDB(retries = 3) {
  return new Promise((resolve, reject) => {
    if (acctDb) { resolve(acctDb); return; }
    const request = indexedDB.open(ACCT_DB_NAME, ACCT_DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('bills')) {
        const store = db.createObjectStore('bills', { keyPath: 'id', autoIncrement: true });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('category', 'category', { unique: false });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('month', 'month', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      acctDb = event.target.result;
      acctDb.onerror = (e) => console.error('AccountingDB error:', e.target.error);
      resolve(acctDb);
    };

    request.onerror = (event) => {
      if (retries > 0) {
        setTimeout(() => openAcctDB(retries - 1).then(resolve).catch(reject), 300);
      } else {
        reject(event.target.error);
      }
    };
  });
}

async function initAcctDB() {
  try { await openAcctDB(); return true; }
  catch (e) { console.error('Failed to init AccountingDB:', e); return false; }
}

function acctTransaction(storeName, mode, callback) {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openAcctDB();
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
      const result = callback(store);
      if (result && result.onsuccess !== undefined) {
        result.onsuccess = (e) => resolve(e.target.result);
        result.onerror = (e) => reject(e.target.error);
      }
    } catch (e) { reject(e); }
  });
}

async function addBill(bill) {
  return acctTransaction('bills', 'readwrite', (store) => {
    return store.add({
      type: bill.type,
      category: bill.category,
      categoryIcon: bill.categoryIcon,
      amount: bill.amount,
      note: bill.note || '',
      date: bill.date,
      month: bill.date.substring(0, 7),
      timestamp: Date.now()
    });
  });
}

async function deleteBill(id) {
  return acctTransaction('bills', 'readwrite', (store) => {
    return store.delete(id);
  });
}

async function updateBill(bill) {
  return acctTransaction('bills', 'readwrite', (store) => {
    return store.put(bill);
  });
}

async function getBillsByMonth(month) {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openAcctDB();
      const tx = db.transaction('bills', 'readonly');
      const store = tx.objectStore('bills');
      const index = store.index('month');
      const request = index.getAll(IDBKeyRange.only(month));
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    } catch (e) { reject(e); }
  });
}

async function getBillsByDate(date) {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openAcctDB();
      const tx = db.transaction('bills', 'readonly');
      const store = tx.objectStore('bills');
      const index = store.index('date');
      const request = index.getAll(IDBKeyRange.only(date));
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    } catch (e) { reject(e); }
  });
}

async function getAllBills() {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openAcctDB();
      const tx = db.transaction('bills', 'readonly');
      const store = tx.objectStore('bills');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    } catch (e) { reject(e); }
  });
}

async function clearAllBills() {
  return acctTransaction('bills', 'readwrite', (store) => {
    store.clear();
  });
}

function calcMonthStats(bills) {
  let income = 0;
  let expense = 0;
  const categoryMap = {};

  bills.forEach(b => {
    const amount = parseFloat(b.amount) || 0;
    if (b.type === 'income') {
      income += amount;
    } else {
      expense += amount;
    }
    const key = b.category;
    if (!categoryMap[key]) {
      categoryMap[key] = { category: b.category, icon: b.categoryIcon, type: b.type, total: 0, count: 0 };
    }
    categoryMap[key].total += amount;
    categoryMap[key].count++;
  });

  const categories = Object.values(categoryMap).sort((a, b) => b.total - a.total);

  return {
    income: income.toFixed(2),
    expense: expense.toFixed(2),
    balance: (income - expense).toFixed(2),
    categories
  };
}

function groupBillsByDate(bills) {
  const groups = {};
  bills.forEach(b => {
    if (!groups[b.date]) {
      groups[b.date] = { date: b.date, bills: [], dayIncome: 0, dayExpense: 0 };
    }
    groups[b.date].bills.push(b);
    const amount = parseFloat(b.amount) || 0;
    if (b.type === 'income') {
      groups[b.date].dayIncome += amount;
    } else {
      groups[b.date].dayExpense += amount;
    }
  });

  return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
}

async function clearAllBills() {
  return acctTransaction('bills', 'readwrite', (store) => {
    store.clear();
  });
}
