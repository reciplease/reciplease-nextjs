export type ShopCapture = {
  scanId: string;
  houseId: string;
  capturedAt: number;
  barcodeImage?: string;
  expirationImage?: string;
  measureImage?: string;
};

export type ShopDraft = {
  barcodeImage: string | null;
  expirationImage: string | null;
  measureImage: string | null;
};

export const EMPTY_DRAFT: ShopDraft = { barcodeImage: null, expirationImage: null, measureImage: null };

const DB_NAME = 'reciplease-shop';
const OUTBOX = 'outbox';
const DRAFT = 'draft';

function openDb(): Promise<IDBDatabase> {
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

async function inStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const request = action(transaction.objectStore(storeName));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export async function addCapture(capture: ShopCapture): Promise<void> {
  await inStore(OUTBOX, 'readwrite', (store) => store.put(capture));
}

export async function listCaptures(houseId: string): Promise<ShopCapture[]> {
  const all = await inStore<ShopCapture[]>(OUTBOX, 'readonly', (store) => store.getAll());
  return all.filter((capture) => capture.houseId === houseId).sort((a, b) => a.capturedAt - b.capturedAt);
}

export async function loadDraft(houseId: string): Promise<ShopDraft> {
  const stored = await inStore<ShopDraft | undefined>(DRAFT, 'readonly', (store) => store.get(houseId));
  return stored ?? EMPTY_DRAFT;
}

export async function saveDraft(houseId: string, draft: ShopDraft): Promise<void> {
  const isEmpty = !draft.barcodeImage && !draft.expirationImage && !draft.measureImage;
  if (isEmpty) {
    await inStore(DRAFT, 'readwrite', (store) => store.delete(houseId));
  } else {
    await inStore(DRAFT, 'readwrite', (store) => store.put(draft, houseId));
  }
}
