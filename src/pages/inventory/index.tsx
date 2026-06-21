import useSWR from 'swr';
import Link from 'next/link';
import Metadata from '@/components/Metadata';
import { toDataUrl } from '@/lib/imageCapture';

const fetcher = (url: string): Promise<InventoryItem[]> =>
  fetch(url).then((res) => res.json());

function isExpired(expiration: string): boolean {
  return new Date(expiration) < new Date();
}

export default function InventoryList() {
  const { data: items, error, isLoading } = useSWR('/api/inventory', fetcher);

  if (isLoading) {
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

  // The pantry is a quick-glance overview — expired stock and the amount/expiry
  // detail live on the "Expiring soon" view instead.
  const pantryItems = items
    .filter((item) => !isExpired(item.expiration))
    .sort((a, b) => a.name.localeCompare(b.name));

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
                <Link href={`/inventory/${item.uuid}`} className="grid gap-2">
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={toDataUrl(item.image)}
                      alt={item.name}
                      className="w-full aspect-square object-cover rounded border border-[#ccc]"
                    />
                  ) : (
                    <div className="w-full aspect-square rounded border border-[#ccc] bg-[#f4f4f4] flex items-center justify-center text-2xl">
                      🥫
                    </div>
                  )}
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
