import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import Metadata from '@/components/Metadata';
import MdyDateInput from '@/components/MdyDateInput';
import InventoryImage from '@/components/InventoryImage';
import { compressToBase64 } from '@/lib/imageCapture';
import { apiFetch, useActiveHouse } from '@/lib/houses';

const itemFetcher = (url: string): Promise<InventoryItem> =>
  apiFetch(url).then((res) => {
    if (!res.ok) throw new Error('Not found');
    return res.json();
  });

const measuresFetcher = (url: string): Promise<Measure[]> =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
    return res.json();
  });

export default function EditInventoryItem() {
  const router = useRouter();
  const uuid = router.query.uuid as string | undefined;
  const activeHouse = useActiveHouse();
  const { data: item, error: itemError, isLoading: itemLoading } = useSWR(
    uuid && activeHouse ? [`/api/inventory/${uuid}`, activeHouse.id] : null,
    () => itemFetcher(`/api/inventory/${uuid}`),
  );
  const { data: measures, isLoading: measuresLoading } = useSWR('/api/measures', measuresFetcher);

  // See the matching comment in the item detail page — same "bounce back to
  // the list instead of leaving a dead-end page" fix, applied here too. Uses
  // the same raw conditions as the render check below rather than a shared
  // boolean, so that check can still narrow `item`'s type.
  useEffect(() => {
    if (router.isReady && activeHouse && !itemLoading && (itemError || !item || !uuid)) {
      router.replace('/inventory');
    }
  }, [router, activeHouse, itemLoading, itemError, item, uuid]);

  if (!router.isReady || !activeHouse || itemLoading) {
    return (
      <>
        <Metadata title="Loading" description="Loading inventory item..." />
        <p>Loading...</p>
      </>
    );
  }

  if (itemError || !item || !uuid) {
    return (
      <>
        <Metadata title="Not Found" description="Inventory item not found" />
        <p>This item no longer exists — taking you back to inventory…</p>
      </>
    );
  }

  return <EditForm uuid={uuid} item={item} measures={measures} measuresLoading={measuresLoading} />;
}

interface EditFormProps {
  uuid: string;
  item: InventoryItem;
  measures?: Measure[];
  measuresLoading: boolean;
}

// Mounted only once the existing item has loaded, so its form fields can
// initialize directly from `item` without an effect syncing props to state.
function EditForm({ uuid, item, measures, measuresLoading }: EditFormProps) {
  const router = useRouter();

  const [name, setName] = useState(item.name);
  const [brand, setBrand] = useState(item.brand ?? '');
  const [measureId, setMeasureId] = useState<MeasureId>(item.measure);
  const [amount, setAmount] = useState(String(item.amount));
  const [expiration, setExpiration] = useState(item.expiration);
  const [barcode, setBarcode] = useState(item.barcode ?? '');
  const [image, setImage] = useState<string | null>(item.image ?? null);

  async function handlePhotoSelected(file: File) {
    try {
      setImage(await compressToBase64(file));
    } catch {
      // Ignore — the item can still be saved without a photo.
    }
  }

  const effectiveMeasureId = measureId || measures?.[0]?.measureId || '';

  const [deleteError, handleDelete, deleting] = useActionState(async (): Promise<string | null> => {
    if (!window.confirm(`Delete ${item.name}? This can't be undone.`)) return null;
    try {
      const res = await apiFetch(`/api/inventory/${uuid}`, { method: 'DELETE' });
      if (!res.ok) {
        return 'Failed to delete item. Please try again.';
      }
      router.push('/inventory');
      return null;
    } catch {
      return 'An unexpected error occurred.';
    }
  }, null);

  const [submitError, handleSubmit, submitting] = useActionState(async (): Promise<string | null> => {
    try {
      // `remaining` must be resent as-is — the backend defaults a missing
      // `remaining` to the new `amount`, which would wipe out how much of
      // the item has already been used.
      const body: CreateInventoryItem & { remaining: number } = {
        name: name.trim(),
        measure: effectiveMeasureId,
        amount: parseFloat(amount),
        remaining: item.remaining,
        expiration,
        ...(brand.trim() ? { brand: brand.trim() } : {}),
        ...(barcode.trim() ? { barcode: barcode.trim() } : {}),
        ...(image ? { image } : {}),
      };
      const res = await apiFetch(`/api/inventory/${uuid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        return 'Failed to save changes. Please try again.';
      }
      router.push(`/inventory/${uuid}`);
      return null;
    } catch {
      return 'An unexpected error occurred.';
    }
  }, null);

  // Both actions render into the same alert spot, same as when they shared
  // one error state. Both failing on this page is an edge case that briefly
  // isn't worth extra state to order precisely — a save error takes display
  // priority if both are present.
  const error = submitError ?? deleteError;

  return (
    <>
      <Metadata title={`Edit ${item.name}`} description="Edit inventory item" />

      <section>
        <h3 className="text-xl font-semibold mb-4">Edit {item.name}</h3>
        <form action={handleSubmit} className="grid gap-2 max-w-sm">
          <label htmlFor="name">Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. milk"
            className="p-2 text-base"
          />
          <p className="text-xs text-[#666] -mt-1">
            Lowercase, phrased how a recipe would say it — e.g. &quot;cherry tomatoes&quot;, not
            &quot;Cherry Tomatoes&quot; or &quot;Sainsbury&apos;s cherry tomatoes&quot; (brand goes below).
          </p>

          <label htmlFor="brand">Brand (optional)</label>
          <input
            id="brand"
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="e.g. Heinz"
            className="p-2 text-base"
          />

          <label htmlFor="measure">Measure</label>
          {measuresLoading ? (
            <select id="measure" disabled>
              <option>Loading...</option>
            </select>
          ) : (
            <select
              id="measure"
              value={effectiveMeasureId}
              onChange={(e) => setMeasureId(e.target.value)}
              className="p-2 text-base"
            >
              {(measures ?? []).map((m) => (
                <option key={m.measureId} value={m.measureId}>
                  {m.plural}
                </option>
              ))}
            </select>
          )}

          <label htmlFor="amount">Amount</label>
          <input
            id="amount"
            type="number"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            placeholder="e.g. 500"
            className="p-2 text-base"
          />

          <label htmlFor="expiration-day">Expiration date</label>
          <MdyDateInput
            idPrefix="expiration"
            value={expiration}
            onChange={setExpiration}
            required
            inputClassName="p-2 text-base"
          />

          <label htmlFor="barcode">Barcode (optional)</label>
          <input
            id="barcode"
            type="text"
            inputMode="numeric"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="e.g. 5012345678900"
            className="p-2 text-base"
          />

          <label htmlFor="photo">Photo (optional)</label>
          <div className="flex items-center gap-4">
            <InventoryImage item={{ image: image ?? undefined, name: '' }} className="w-16 h-16 object-cover rounded" />
            <input
              id="photo"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePhotoSelected(file);
                e.target.value = '';
              }}
              className="text-base"
            />
          </div>

          {error && <p role="alert">{error}</p>}

          <button type="submit" disabled={submitting} className="mt-2">
            {submitting ? 'Saving...' : 'Save changes'}
          </button>
        </form>

        {/* A standalone one-button form, not onClick, so handleDelete's
            useActionState dispatch runs inside a proper transition (needed
            for `deleting` to track correctly). */}
        <form action={handleDelete}>
          <button
            type="submit"
            disabled={deleting}
            className="mt-4 w-fit rounded border-2 border-red-600 px-2 py-1 text-sm text-red-600 hover:bg-red-600 hover:text-white disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete item'}
          </button>
        </form>
      </section>
    </>
  );
}
