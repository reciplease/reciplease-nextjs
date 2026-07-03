import useSWR from 'swr';
import Link from 'next/link';
import Metadata from '@/components/Metadata';
import InventoryImage from '@/components/InventoryImage';
import { apiFetch, useActiveHouse } from '@/lib/houses';

const fetcher = (url: string): Promise<InventoryItem[]> =>
  apiFetch(url).then((res) => res.json());

function isExpired(expiration: string): boolean {
  return new Date(expiration) < new Date();
}

function isFullyConsumed(item: InventoryItem): boolean {
  return (item.remaining ?? item.amount ?? 0) <= 0;
}

// Expired or fully-eaten items aren't hidden — they're still physically
// absent/unusable, but the user may still want to see them (e.g. to restock)
// — so they stay in the list, just greyed out and sorted after everything
// still usable.
function isInactive(item: InventoryItem): boolean {
  return isExpired(item.expiration) || isFullyConsumed(item);
}

export default function InventoryList() {
  // Wait for the active house before fetching: house-scoped calls need the
  // X-RCPLS-House-Id header, which is only known once houses have loaded. Keying
  // by house id also refetches if the user switches house.
  const activeHouse = useActiveHouse();
  const { data: items, error, isLoading } = useSWR(
    activeHouse ? ['/api/inventory', activeHouse.id] : null,
    () => fetcher('/api/inventory'),
  );

  if (!activeHouse || isLoading) {
    return (
      <>
        <Metadata title="Loading Inventory" description="Loading inventory..." />
        <p>Loading...</p>
      </>
    );
  }

  if (error || !items) {
    return (
      <>
        <Metadata title="Inventory" description="Your ingredient inventory" />
        <p>Could not load inventory</p>
      </>
    );
  }

  // Active items first (alphabetically), then expired/fully-consumed ones
  // (also alphabetically) — greyed out below, rather than hidden. Full
  // amount/expiry detail still lives on the "Expiring soon" view.
  const pantryItems = [...items].sort((a, b) => {
    const aInactive = isInactive(a);
    const bInactive = isInactive(b);
    if (aInactive !== bInactive) return aInactive ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  return (
    <>
      <Metadata title="Inventory" description="Your ingredient inventory" />

      <section className="grid gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xl font-semibold mr-auto">Inventory</h3>
          <Link href="/inventory/expiring" className="text-sm underline">Expiring soon →</Link>
        </div>

        {pantryItems.length === 0 ? (
          <p>No items in inventory</p>
        ) : (
          // 110px min comfortably fits ~5 across the page's 80ch reading column
          // (see .content-grid in main.scss) regardless of monitor width —
          // widening that column isn't the fix, these were just too big.
          // auto-fill (not auto-fit): auto-fit collapses unused tracks and
          // hands their share of the row to the populated ones via the `1fr`,
          // so a short list (e.g. 2 items) stretches each tile to half the
          // row. auto-fill keeps the unused tracks around as empty space
          // instead, so tiles stay close to their minmax size regardless of
          // how many items there are.
          <ul className="list-none p-0 grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-4 my-8">
            {pantryItems.map((item) => (
              <li key={item.uuid}>
                <Link
                  href={`/inventory/${item.uuid}`}
                  className={`grid gap-2${isInactive(item) ? ' opacity-60' : ''}`}
                >
                  <InventoryImage
                    item={item}
                    className="w-full aspect-square object-cover rounded border border-[#ccc]"
                  />
                  <h4 className="font-medium text-center text-sm">{item.name}</h4>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
