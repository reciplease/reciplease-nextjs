import { FormEvent, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import useSWR from 'swr';
import Metadata from '@/components/Metadata';
import { compressToBase64, toDataUrl } from '@/lib/imageCapture';
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
        <p>Item not found</p>
        <Link href="/inventory">Back to inventory</Link>
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
  const [measureId, setMeasureId] = useState<MeasureId>(item.measure);
  const [amount, setAmount] = useState(String(item.amount));
  const [expiration, setExpiration] = useState(item.expiration);
  const [barcode, setBarcode] = useState(item.barcode ?? '');
  const [image, setImage] = useState<string | null>(item.image ?? null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handlePhotoSelected(file: File) {
    try {
      setImage(await compressToBase64(file));
    } catch {
      // Ignore — the item can still be saved without a photo.
    }
  }

  const effectiveMeasureId = measureId || measures?.[0]?.measureId || '';

  async function handleDelete() {
    if (!window.confirm(`Delete ${item.name}? This can't be undone.`)) return;
    setError(null);
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/inventory/${uuid}`, { method: 'DELETE' });
      if (!res.ok) {
        setError('Failed to delete item. Please try again.');
        return;
      }
      router.push('/inventory');
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body: CreateInventoryItem = {
        name: name.trim(),
        measure: effectiveMeasureId,
        amount: parseFloat(amount),
        expiration,
        ...(barcode.trim() ? { barcode: barcode.trim() } : {}),
        ...(image ? { image } : {}),
      };
      const res = await apiFetch(`/api/inventory/${uuid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError('Failed to save changes. Please try again.');
        return;
      }
      router.push(`/inventory/${uuid}`);
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Metadata title={`Edit ${item.name}`} description="Edit inventory item" />

      <section>
        <h3 className="text-xl font-semibold mb-4">Edit {item.name}</h3>
        <form onSubmit={handleSubmit} className="grid gap-2 max-w-sm">
          <label htmlFor="name">Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Milk"
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

          <label htmlFor="expiration">Expiration date</label>
          <input
            id="expiration"
            type="date"
            value={expiration}
            onChange={(e) => setExpiration(e.target.value)}
            required
            className="p-2 text-base"
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
            {image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={toDataUrl(image)} alt="" className="w-16 h-16 object-cover rounded" />
            )}
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

        <button
          type="button"
          disabled={deleting}
          onClick={handleDelete}
          className="mt-4 w-fit rounded border-2 border-red-600 px-2 py-1 text-sm text-red-600 hover:bg-red-600 hover:text-white disabled:opacity-50"
        >
          {deleting ? 'Deleting…' : 'Delete item'}
        </button>
      </section>
    </>
  );
}
