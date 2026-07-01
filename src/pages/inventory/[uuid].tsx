import { FormEvent, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Metadata from '@/components/Metadata';
import InventoryImage from '@/components/InventoryImage';
import { formatDate, formatTimestamp } from '@/lib/formatDate';
import { useMeasures, findMeasure } from '@/lib/measures';
import { apiFetch, useActiveHouse } from '@/lib/houses';

const fetcher = (url: string): Promise<InventoryItem> =>
  apiFetch(url).then((res) => {
    if (!res.ok) throw new Error('Not found');
    return res.json();
  });

function isExpired(expiration: string): boolean {
  return new Date(expiration) < new Date();
}

export default function InventoryItemPage() {
  const router = useRouter();
  const uuid = router.query.uuid as string | undefined;
  const activeHouse = useActiveHouse();
  const swrKey = uuid && activeHouse ? [`/api/inventory/${uuid}`, activeHouse.id] : null;
  const { data: item, error, isLoading, mutate } = useSWR(swrKey, () => fetcher(`/api/inventory/${uuid}`));
  const measures = useMeasures();

  if (!router.isReady || !activeHouse || isLoading) {
    return (
      <>
        <Metadata title="Loading" description="Loading inventory item..." />
        <p>Loading...</p>
      </>
    );
  }

  if (error || !item || !uuid) {
    return (
      <>
        <Metadata title="Not Found" description="Inventory item not found" />
        <p>Item not found</p>
        <Link href="/inventory">Back to inventory</Link>
      </>
    );
  }

  const expired = isExpired(item.expiration);

  return (
    <>
      <Metadata title={item.name} description={`${item.name} inventory item`} />

      <section className="grid gap-3">
        <Link href="/inventory" className="text-sm">← Back to inventory</Link>
        {/* Edit sits top-right next to the title on every detail page (see
            recipes/[recipeId].tsx) rather than wherever happened to fit. */}
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-xl font-semibold">{item.name}</h3>
          <Link
            href={`/inventory/${uuid}/edit`}
            className="w-fit shrink-0 rounded border-2 border-secondary px-2 py-1 text-sm whitespace-nowrap"
          >
            Edit
          </Link>
        </div>
        {/* Plain block flow (not grid/flex) so the float below actually wraps
            text around it — grid/flex containers ignore float on their items.
            overflow-hidden gives it a block formatting context so the
            container still grows to contain the floated image's height, and
            space-y-3 replaces the `gap` spacing those layouts would have given
            us for free. */}
        <div className="space-y-3 overflow-hidden">
          <InventoryImage
            item={item}
            className="float-right ml-4 w-32 h-32 object-cover rounded-lg border border-[#ccc]"
          />
          <p>
            Amount: {item.remaining} of {item.amount} {displayMeasure(item, measures)}
          </p>
          <AdjustRemainingForm uuid={uuid} item={item} onSaved={mutate} />
          <p className={expired ? 'opacity-60' : ''}>
            Expires: {formatDate(item.expiration)}
            {expired && ' — expired'}
          </p>
          {item.barcode && (
            <p className="text-sm text-[#666]">Barcode: {item.barcode}</p>
          )}
          {item.updatedAt && (
            <p className="text-sm text-[#666]">
              Last updated: {formatTimestamp(item.updatedAt)}
            </p>
          )}
        </div>
      </section>
    </>
  );
}

function displayMeasure(item: InventoryItem, measures: Measure[]): string {
  const measure = findMeasure(item.measure, measures);
  if (!measure) return item.measure;
  return item.amount === 1 ? measure.singular : measure.plural;
}

interface AdjustRemainingFormProps {
  uuid: string;
  item: InventoryItem;
  onSaved: () => void;
}

// Lets a user record how much of an item is left without going through the
// full edit form. Setting it to 0 removes the item entirely rather than
// leaving a zero-remaining zombie in the list.
function AdjustRemainingForm({ uuid, item, onSaved }: AdjustRemainingFormProps) {
  const router = useRouter();
  const [remaining, setRemaining] = useState(String(item.remaining));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const parsedRemaining = parseFloat(remaining);
  const unchanged = !remaining || parsedRemaining === item.remaining;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (parsedRemaining <= 0) {
        if (!window.confirm(`Mark ${item.name} as fully used? It will be removed from your inventory.`)) {
          return;
        }
        const res = await apiFetch(`/api/inventory/${uuid}`, { method: 'DELETE' });
        if (!res.ok) {
          setError('Failed to remove item. Please try again.');
          return;
        }
        router.push('/inventory');
        return;
      }

      const body: CreateInventoryItem & { remaining: number } = {
        name: item.name,
        measure: item.measure,
        amount: item.amount,
        remaining: parsedRemaining,
        expiration: item.expiration,
        ...(item.barcode ? { barcode: item.barcode } : {}),
        ...(item.image ? { image: item.image } : {}),
      };
      const res = await apiFetch(`/api/inventory/${uuid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError('Failed to update amount. Please try again.');
        return;
      }
      onSaved();
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <label htmlFor="remaining" className="sr-only">Amount remaining</label>
      <input
        id="remaining"
        type="number"
        min="0"
        step="any"
        value={remaining}
        onChange={(e) => setRemaining(e.target.value)}
        className="w-24 p-2 text-base"
      />
      <button type="submit" disabled={submitting || unchanged} className="px-2 py-1 text-sm">
        {submitting ? 'Saving...' : 'Update'}
      </button>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
