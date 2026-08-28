// Durable backup of the shop-capture failed-upload queue, keyed per house. A crashed
// browser, killed phone, or logout must not silently lose captures that failed to
// upload — localStorage (not sessionStorage) survives all three, since it isn't
// tab- or session-scoped.
const storageKey = (houseId: string) => `reciplease:shop-failed:${houseId}`;

export function loadFailedQueue(houseId: string): CreatePendingPantryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey(houseId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveFailedQueue(houseId: string, items: CreatePendingPantryItem[]): void {
  if (typeof window === 'undefined') return;
  if (items.length === 0) {
    window.localStorage.removeItem(storageKey(houseId));
  } else {
    window.localStorage.setItem(storageKey(houseId), JSON.stringify(items));
  }
}
