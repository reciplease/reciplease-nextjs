import { useEffect } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Metadata from '@/components/Metadata';
import PantryImage from '@/components/PantryImage';
import EatFlow from '@/components/pantry/EatFlow';
import ThrowAwayFlow from '@/components/pantry/ThrowAwayFlow';
import { formatDate, formatTimestamp } from '@/lib/formatDate';
import { useMeasures, findMeasure } from '@/lib/measures';
import { apiFetch, useActiveHouse } from '@/lib/houses';

const fetcher = (url: string): Promise<PantryItem> =>
  apiFetch(url).then((res) => {
    if (!res.ok) throw new Error('Not found');
    return res.json();
  });

function isExpired(expiration: string): boolean {
  return new Date(expiration) < new Date();
}

export default function PantryItemPage() {
  const router = useRouter();
  const uuid = router.query.uuid as string | undefined;
  const activeHouse = useActiveHouse();
  const swrKey = uuid && activeHouse ? [`/api/pantry/${uuid}`, activeHouse.id] : null;
  const { data: item, error, isLoading, mutate } = useSWR(swrKey, () => fetcher(`/api/pantry/${uuid}`));
  const measures = useMeasures();

  // Covers both a stale/bad link straight to a deleted item and eating/binning
  // the last of an item while already on its page (the backend deletes it —
  // see lib/pantry.ts — so the next revalidation 404s here too). Either
  // way, there's nothing to show, so bounce back to the list rather than
  // leaving the user on a dead "not found" page they have to click out of.
  // Uses the same raw conditions as the render check below rather than a
  // shared boolean, so that check can still narrow `item`'s type.
  useEffect(() => {
    if (router.isReady && activeHouse && !isLoading && (error || !item || !uuid)) {
      router.replace('/pantry');
    }
  }, [router, activeHouse, isLoading, error, item, uuid]);

  if (!router.isReady || !activeHouse || isLoading) {
    return (
      <>
        <Metadata title="Loading" description="Loading pantry item..." />
        <p>Loading...</p>
      </>
    );
  }

  if (error || !item || !uuid) {
    return (
      <>
        <Metadata title="Not Found" description="Pantry item not found" />
        <p>This item no longer exists — taking you back to pantry…</p>
      </>
    );
  }

  const expired = isExpired(item.expiration);

  return (
    <>
      <Metadata title={item.name} description={`${item.name} pantry item`} />

      <section className="grid gap-3">
        <Link href="/pantry" className="text-sm">← Back to pantry</Link>
        {/* Edit sits top-right next to the title on every detail page (see
            recipes/[recipeId].tsx) rather than wherever happened to fit. */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold">{item.name}</h3>
            {item.brand && <p className="text-sm text-[#666]">{item.brand}</p>}
          </div>
          <Link
            href={`/pantry/${uuid}/edit`}
            className="w-fit shrink-0 rounded border-2 border-secondary px-2 py-1 text-sm whitespace-nowrap"
            aria-label="Edit"
          >
            <span className="md:hidden" aria-hidden="true">
              ✏️
            </span>
            <span className="hidden md:inline">Edit</span>
          </Link>
        </div>
        {/* Plain block flow (not grid/flex) so the float below actually wraps
            text around it — grid/flex containers ignore float on their items.
            overflow-hidden gives it a block formatting context so the
            container still grows to contain the floated image's height, and
            space-y-3 replaces the `gap` spacing those layouts would have given
            us for free. */}
        <div className="space-y-3 overflow-hidden">
          <PantryImage
            item={item}
            className="float-right ml-4 w-32 h-32 object-cover rounded-lg border border-[#ccc]"
          />
          <p>
            Amount: {item.remaining} of {item.amount} {displayMeasure(item, measures)}
          </p>
          <p>
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

      {/* Floating "log eaten" trigger + panel — see EatFlow for why it also
          owns the (optional, only when Google Health is linked) food-log step.
          ThrowAwayFlow is the no-food-diary sibling: same remaining decrement,
          but binned food never gets logged to Google Health. Neither renders
          once nothing is left — there's nothing to eat or bin. */}
      {item.remaining > 0 && (
        <>
          <EatFlow uuid={uuid} item={item} onSaved={mutate} />
          <ThrowAwayFlow uuid={uuid} item={item} onSaved={mutate} />
        </>
      )}
    </>
  );
}

function displayMeasure(item: PantryItem, measures: Measure[]): string {
  const measure = findMeasure(item.measure, measures);
  if (!measure) return item.measure;
  return item.amount === 1 ? measure.singular : measure.plural;
}
