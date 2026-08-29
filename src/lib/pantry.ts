import { updatePantryItem } from '@/types/generated/client';
import { isSuccessResponse } from '@/lib/apiClientMutator';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Whole calendar days between today and the expiration date — negative once
// it's passed. `expiration` is built from its Y/M/D parts (not `new
// Date(expiration)`, which treats a date-only string as UTC midnight and can
// land on the wrong local calendar day) so this matches "today" in whatever
// timezone the browser is in, not UTC.
export function daysUntil(expiration: string): number {
  const [year, month, day] = expiration.split('-').map(Number);
  const expiresAt = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((expiresAt.getTime() - today.getTime()) / MS_PER_DAY);
}

export function formatDaysLeft(daysLeft: number): string {
  if (daysLeft > 1) return `${daysLeft} days left`;
  if (daysLeft === 1) return '1 day left';
  if (daysLeft === 0) return 'Expires today';
  if (daysLeft === -1) return 'Expired yesterday';
  return `Expired ${Math.abs(daysLeft)} days ago`;
}

// Red/amber/green by urgency: already-expired-or-expiring-imminently, due
// within the week, or comfortably further out.
export function daysLeftColor(daysLeft: number): string {
  if (daysLeft <= 2) return 'text-red-600';
  if (daysLeft <= 7) return 'text-amber-600';
  return 'text-green-600';
}

/**
 * Records binning `thrown` units of `item` — decrements `remaining` (clamped
 * at zero) via the same PUT the edit form uses. If that empties the item,
 * the backend archives and deletes it (204, no body) instead of returning
 * an updated item — `res.ok` covers both outcomes; the pantry list simply
 * won't see the item again once it's gone. Shared by the item detail page's
 * ThrowAwayFlow FAB and the inline quick-action on the pantry/expiring-soon
 * list tiles.
 */
export async function binPantryItem(uuid: string, item: PantryItem, thrown: number): Promise<boolean> {
  const newRemaining = Math.max(0, item.remaining - (Number.isFinite(thrown) ? thrown : 0));
  const body: CreatePantryItem & { remaining: number } = {
    name: item.name,
    measure: item.measure,
    amount: item.amount,
    remaining: newRemaining,
    expiration: item.expiration,
    ...(item.barcode ? { barcode: item.barcode } : {}),
    ...(item.image ? { image: item.image } : {}),
  };
  try {
    const result = await updatePantryItem(uuid, body);
    return isSuccessResponse(result);
  } catch {
    return false;
  }
}
