import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import Metadata from '@/components/Metadata';
import { toDataUrl } from '@/lib/imageCapture';
import { apiFetch, useActiveHouse } from '@/lib/houses';

const fetcher = (url: string): Promise<PendingInventoryItem[]> =>
  apiFetch(url).then((res) => {
    if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
    return res.json();
  });

// Small photo tile for a pending capture. Unlike InventoryImage this deals in
// raw base64 (pending photos aren't inventory items yet) and shows which
// photo is missing rather than a generic placeholder.
function PendingThumb({ image, label }: { image?: string; label: string }) {
  if (!image) {
    return (
      <div className="w-14 h-14 rounded bg-zinc-100 flex items-center justify-center text-[10px] text-zinc-400 text-center leading-tight">
        No {label}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={toDataUrl(image)} alt={label} className="w-14 h-14 rounded object-cover" />;
}

// The backlog created by /inventory/shop: each row is one captured item still
// waiting to be digitised into a real inventory item.
export default function ProcessListPage() {
  const activeHouse = useActiveHouse();
  const { data: items, error, isLoading, mutate } = useSWR(
    activeHouse ? ['/api/inventory/pending', activeHouse.id] : null,
    () => fetcher('/api/inventory/pending'),
  );
  const [discarding, setDiscarding] = useState<string | null>(null);

  if (!activeHouse || isLoading) {
    return (
      <>
        <Metadata title="Loading" description="Loading pending items..." />
        <p>Loading...</p>
      </>
    );
  }

  if (error || !items) {
    return (
      <>
        <Metadata title="Process shop" description="Process captured shop items" />
        <p>Could not load pending items</p>
      </>
    );
  }

  async function handleDiscard(uuid: string) {
    setDiscarding(uuid);
    try {
      const res = await apiFetch(`/api/inventory/pending/${uuid}`, { method: 'DELETE' });
      if (res.ok) await mutate();
    } finally {
      setDiscarding(null);
    }
  }

  return (
    <>
      <Metadata title="Process shop" description="Process captured shop items" />

      <section className="grid gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xl font-semibold mr-auto">Process captured items</h3>
          <Link href="/inventory/shop" className="text-sm underline">Capture more →</Link>
        </div>

        {items.length === 0 ? (
          <div className="grid gap-2">
            <p>Nothing to process — all caught up! 🎉</p>
            <Link href="/inventory" className="underline w-fit">Back to inventory</Link>
          </div>
        ) : (
          <ul className="list-none p-0 grid gap-3 my-4">
            {items.map((item) => (
              <li key={item.uuid} className="flex items-center gap-4 rounded border border-zinc-200 p-3">
                <PendingThumb image={item.expirationImage} label="expiration photo" />
                <PendingThumb image={item.measureImage} label="measure photo" />
                <div className="mr-auto min-w-0">
                  {item.barcode ? (
                    <p className="font-mono text-sm truncate">{item.barcode}</p>
                  ) : (
                    <p className="text-sm text-zinc-500">No barcode</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDiscard(item.uuid)}
                  disabled={discarding === item.uuid}
                  className="rounded border-2 border-red-600 px-2 py-1 text-sm text-red-600 hover:bg-red-600 hover:text-white disabled:opacity-50"
                >
                  Discard
                </button>
                <Link
                  href={`/inventory/shop/process/${item.uuid}`}
                  className="rounded bg-highlight px-3 py-1.5 text-sm font-semibold text-white"
                >
                  Process
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
