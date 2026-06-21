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
          <Link href="/inventory/create" className="text-sm underline">Add to inventory</Link>
        </div>

        {pantryItems.length === 0 ? (
          <p>No items in inventory</p>
        ) : (
          <ul className="list-none p-0 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-4 my-8">
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
                    <div className="w-full aspect-square rounded border border-[#ccc] bg-[#f4f4f4] flex items-center justify-center text-3xl">
                      🥫
                    </div>
                  )}
                  <h4 className="font-medium text-center">{item.name}</h4>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
