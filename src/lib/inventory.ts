import { apiFetch } from '@/lib/houses';

// Fully-eaten items aren't hidden from the pantry list — they're physically
// gone, but the user may still want to see them (e.g. to restock), so this
// only controls display/sort treatment there (see inventory/index.tsx). The
// expiring-soon list uses the same check to drop them outright instead:
// nothing left means nothing left to expire.
export function isFullyConsumed(item: InventoryItem): boolean {
  return (item.remaining ?? item.amount ?? 0) <= 0;
}

/**
 * Records binning `thrown` units of `item` — decrements `remaining` (clamped
 * at zero, the item is never deleted) via the same PUT the edit form uses.
 * Shared by the item detail page's ThrowAwayFlow FAB and the inline
 * quick-action on the pantry/expiring-soon list tiles.
 */
export async function binInventoryItem(uuid: string, item: InventoryItem, thrown: number): Promise<boolean> {
  const newRemaining = Math.max(0, item.remaining - (Number.isFinite(thrown) ? thrown : 0));
  const body: CreateInventoryItem & { remaining: number } = {
    name: item.name,
    measure: item.measure,
    amount: item.amount,
    remaining: newRemaining,
    expiration: item.expiration,
    ...(item.barcode ? { barcode: item.barcode } : {}),
    ...(item.image ? { image: item.image } : {}),
  };
  const res = await apiFetch(`/api/inventory/${uuid}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.ok;
}
