import { addCapture } from '@/lib/shopOutbox';

const storageKey = (houseId: string) => `reciplease:shop-failed:${houseId}`;

function readLegacyQueue(houseId: string): CreatePendingPantryItem[] {
  try {
    const raw = window.localStorage.getItem(storageKey(houseId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function migrateFailedQueue(houseId: string): Promise<void> {
  const legacy = readLegacyQueue(houseId);
  if (legacy.length === 0) return;
  const migratedAt = Date.now();
  for (let index = 0; index < legacy.length; index++) {
    await addCapture({ ...legacy[index], scanId: crypto.randomUUID(), houseId, capturedAt: migratedAt + index });
  }
  window.localStorage.removeItem(storageKey(houseId));
}
