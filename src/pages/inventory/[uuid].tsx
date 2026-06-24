import useSWR from 'swr';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Metadata from '@/components/Metadata';
import { formatDate, formatTimestamp } from '@/lib/formatDate';
import { toDataUrl } from '@/lib/imageCapture';
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
  const { data: item, error, isLoading } = useSWR(
    uuid && activeHouse ? [`/api/inventory/${uuid}`, activeHouse.id] : null,
    () => fetcher(`/api/inventory/${uuid}`),
  );
  const measures = useMeasures();

  if (!router.isReady || !activeHouse || isLoading) {
    return (
      <>
        <Metadata title="Loading" description="Loading inventory item..." />
        <p>Loading...</p>
      </>
    );
  }

  if (error || !item) {
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
          {item.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={toDataUrl(item.image)}
              alt=""
              className="float-right ml-4 w-32 h-32 object-cover rounded-lg border border-[#ccc]"
            />
          )}
          <p>
            Amount: {item.amount}{' '}
            {displayMeasure(item, measures)}
          </p>
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
