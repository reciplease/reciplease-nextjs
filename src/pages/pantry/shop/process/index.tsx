import { useState } from 'react';
import Link from 'next/link';
import Metadata from '@/components/Metadata';
import { toDataUrl } from '@/lib/imageCapture';
import { useActiveHouse } from '@/lib/houses';
import { useFindAllPendingPantryItems, discardPendingPantryItem } from '@/types/generated/client';
import { isSuccessResponse } from '@/lib/apiClientMutator';

// Small photo tile for a pending capture. Unlike PantryImage this deals in
// raw base64 (pending photos aren't pantry items yet) and shows which
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

// Barcode tile — a photo for anything captured with the current flow, or the
// already-decoded number for items captured before that (see
// PendingPantryItem.legacyBarcode on the backend); "No barcode photo" only
// once neither is present.
function BarcodeThumb({ item }: { item: PendingPantryItem }) {
  if (item.barcodeImage) {
    return <PendingThumb image={item.barcodeImage} label="barcode photo" />;
  }
  if (item.legacyBarcode) {
    return (
      <div className="w-14 h-14 rounded bg-zinc-100 flex items-center justify-center text-[10px] text-zinc-700 text-center leading-tight px-0.5 font-mono break-all">
        {item.legacyBarcode}
      </div>
    );
  }
  return <PendingThumb label="barcode photo" />;
}

// The backlog created by /pantry/shop: each row is one captured item still
// waiting to be digitised into a real pantry item.
export default function ProcessListPage() {
  const activeHouse = useActiveHouse();
  // Note: the generated hook's cache key isn't house-scoped (unlike the
  // hand-written `[url, houseId]` key this replaced) — switching house no
  // longer forces a refetch here. Left as-is per the migration's accepted
  // key-shape trade-off.
  const { data: itemsResponse, error, isLoading, mutate } = useFindAllPendingPantryItems({
    swr: { enabled: Boolean(activeHouse) },
  });
  const items = itemsResponse && isSuccessResponse(itemsResponse) ? itemsResponse.data : undefined;
  const itemsError = error || (itemsResponse && !isSuccessResponse(itemsResponse));
  const [discarding, setDiscarding] = useState<string | null>(null);

  if (!activeHouse || isLoading) {
    return (
      <>
        <Metadata title="Loading" description="Loading pending items..." />
        <p>Loading...</p>
      </>
    );
  }

  if (itemsError || !items) {
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
      const result = await discardPendingPantryItem(uuid);
      if (isSuccessResponse(result)) {
        await mutate();
      }
      // Otherwise ignore — discarding failed, so the item just stays in the list.
    } catch {
      // Ignore — discarding failed, so the item just stays in the list.
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
          <Link href="/pantry/shop" className="text-sm underline">Capture more →</Link>
        </div>

        {items.length === 0 ? (
          <div className="grid gap-2">
            <p>Nothing to process — all caught up! 🎉</p>
            <Link href="/pantry" className="underline w-fit">Back to pantry</Link>
          </div>
        ) : (
          <ul className="list-none p-0 grid gap-3 my-4">
            {items.map((item) => (
              <li key={item.uuid} className="grid gap-2 rounded border border-zinc-200 p-3">
                <div className="flex items-center gap-4">
                  <BarcodeThumb item={item} />
                  <PendingThumb image={item.expirationImage} label="expiration photo" />
                  <PendingThumb image={item.measureImage} label="measure photo" />
                  <div className="mr-auto" />
                  <Link
                    href={`/pantry/shop/process/${item.uuid}`}
                    className="rounded bg-highlight px-3 py-1.5 text-sm font-semibold text-white"
                  >
                    Process
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDiscard(item.uuid)}
                    disabled={discarding === item.uuid}
                    aria-label="Discard"
                    title="Discard"
                    className="w-7 h-7 shrink-0 grid place-items-center rounded-full border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white disabled:opacity-50"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    >
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
                {item.updatedAt && (
                  <p className="text-xs text-zinc-500">
                    Scanned {new Date(item.updatedAt).toLocaleString()}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
