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

  return (
    <>
      <Metadata title="Inventory" description="Your ingredient inventory" />

      <section className="grid gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xl font-semibold mr-auto">Inventory</h3>
        </div>

        {items.length === 0 ? (
          <p>No items in inventory</p>
        ) : (
          <ul className="list-none p-0 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 my-8">
            {items.map((item) => (
              <li key={item.uuid}>
                <Link href={`/inventory/${item.uuid}`}>
                  <article className={`p-4 border border-[#ccc] rounded cursor-pointer${isExpired(item.expiration) ? ' opacity-60' : ''}`}>
                    {item.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={toDataUrl(item.image)}
                        alt=""
                        className="w-full aspect-square object-cover rounded mb-2"
                      />
                    )}
                    <h4 className="font-medium">{item.name}</h4>
                    <p>
                      {item.amount}{' '}
                      {item.amount === 1 ? item.measure.singular : item.measure.plural}
                    </p>
                    <p className="text-sm text-[#666]">
                      Expires: {item.expiration}
                      {isExpired(item.expiration) && ' (expired)'}
                    </p>
                  </article>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
