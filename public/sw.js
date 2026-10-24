const DB_NAME = 'reciplease-shop';
const OUTBOX = 'outbox';
const DRAFT = 'draft';
const BULK_URL = '/api/pantry/pending/bulk';
const HOUSE_HEADER = 'X-RCPLS-House-Id';
const SYNC_TAG = 'shop-upload';
const MAX_BATCH_BYTES = 3000000;
const MAX_BATCH_ITEMS = 50;

function openDb() {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(DB_NAME, 1);
    opening.onupgradeneeded = () => {
      opening.result.createObjectStore(OUTBOX, { keyPath: 'scanId' });
      opening.result.createObjectStore(DRAFT);
    };
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(opening.error);
  });
}

function readAll(db) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(OUTBOX, 'readonly').objectStore(OUTBOX).getAll();
    request.onsuccess = () => resolve(request.result.sort((a, b) => a.capturedAt - b.capturedAt));
    request.onerror = () => reject(request.error);
  });
}

function removeAll(db, scanIds) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(OUTBOX, 'readwrite');
    scanIds.forEach((scanId) => transaction.objectStore(OUTBOX).delete(scanId));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function toBatches(captures) {
  const batches = [];
  let current = null;
  let currentBytes = 0;
  captures.forEach((capture) => {
    const { houseId, capturedAt, ...item } = capture;
    const bytes = JSON.stringify(item).length;
    const fits =
      current &&
      current.houseId === houseId &&
      current.items.length < MAX_BATCH_ITEMS &&
      currentBytes + bytes <= MAX_BATCH_BYTES;
    if (!fits) {
      current = { houseId, items: [] };
      currentBytes = 0;
      batches.push(current);
    }
    current.items.push(item);
    currentBytes += bytes;
  });
  return batches;
}

async function notifyClients() {
  const clients = await self.clients.matchAll();
  clients.forEach((client) => client.postMessage({ type: 'shop-outbox-changed' }));
}

async function upload() {
  const db = await openDb();
  try {
    const captures = await readAll(db);
    for (const batch of toBatches(captures)) {
      const response = await fetch(BULK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', [HOUSE_HEADER]: batch.houseId },
        body: JSON.stringify({ items: batch.items }),
      });
      if (!response.ok) throw new Error(`Bulk upload failed with status ${response.status}`);
      const receipts = await response.json();
      await removeAll(
        db,
        receipts.map((receipt) => receipt.scanId),
      );
      await notifyClients();
    }
  } finally {
    db.close();
  }
}

let flushing = null;

function flushOutbox() {
  if (!flushing) {
    flushing = upload().finally(() => {
      flushing = null;
    });
  }
  return flushing;
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Required for Chrome's PWA installability check (Add to Home Screen on Android).
self.addEventListener('fetch', () => {});

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) event.waitUntil(flushOutbox());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'flush-shop') event.waitUntil(flushOutbox().catch(() => {}));
});
