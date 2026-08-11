import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import Metadata from '@/components/Metadata';
import InventoryImage from '@/components/InventoryImage';
import ThrowAwayPanel from '@/components/inventory/ThrowAwayPanel';
import { apiFetch, useActiveHouse } from '@/lib/houses';
import { useMeasures, findMeasure } from '@/lib/measures';
import { isFullyConsumed, daysUntil, formatDaysLeft, daysLeftColor } from '@/lib/inventory';

const fetcher = (url: string): Promise<InventoryItem[]> =>
  apiFetch(url).then((res) => res.json());

type ItemWithDaysLeft = InventoryItem & { daysLeft: number };

function displayMeasure(item: InventoryItem, measures: Measure[]): string {
  const measure = findMeasure(item.measure, measures);
  if (!measure) return item.measure;
  return item.remaining === 1 ? measure.singular : measure.plural;
}

function InventoryTile({
  item,
  daysLeft,
  measures,
  onThrowAway,
}: {
  item: InventoryItem;
  daysLeft?: number;
  measures: Measure[];
  onThrowAway: (item: InventoryItem) => void;
}) {
  const consumed = isFullyConsumed(item);
  return (
    <li className="relative">
      <Link
        href={`/inventory/${item.uuid}`}
        className={`grid gap-2${consumed ? ' opacity-60' : ''}`}
      >
        <InventoryImage
          item={item}
          className="w-full aspect-square object-cover rounded border border-[#ccc]"
        />
        {daysLeft === undefined ? (
          <h4 className="font-medium text-center text-sm">{item.name}</h4>
        ) : (
          <h5 className="font-medium text-center text-sm">{item.name}</h5>
        )}
        {daysLeft !== undefined && (
          <>
            <p className="text-center text-xs text-[#666] -mt-1">
              {item.remaining} {displayMeasure(item, measures)}
            </p>
            <p className={`text-center text-xs font-medium -mt-1 ${daysLeftColor(daysLeft)}`}>
              {formatDaysLeft(daysLeft)}
            </p>
          </>
        )}
      </Link>
      {!consumed && (
        <button
          type="button"
          aria-label={`Throw away ${item.name}`}
          title="Throw away"
          onClick={(e) => {
            e.preventDefault();
            onThrowAway(item);
          }}
          className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full border-0 bg-black/60 leading-none text-white transition hover:bg-black/80"
        >
          <span aria-hidden="true">🗑</span>
        </button>
      )}
    </li>
  );
}

// 110px min comfortably fits ~5 across the page's 80ch reading column
// (see .content-grid in main.scss) regardless of monitor width — widening
// that column isn't the fix, these were just too big. auto-fill (not
// auto-fit): auto-fit collapses unused tracks and hands their share of the
// row to the populated ones via the `1fr`, so a short list (e.g. 2 items)
// stretches each tile to half the row. auto-fill keeps the unused tracks
// around as empty space instead, so tiles stay close to their minmax size
// regardless of how many items there are.
const TILE_GRID = 'list-none p-0 grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-4 my-4';

function ExpirationSection({
  title,
  items,
  measures,
  onThrowAway,
}: {
  title: string;
  items: ItemWithDaysLeft[];
  measures: Measure[];
  onThrowAway: (item: InventoryItem) => void;
}) {
  return (
    <div>
      <h4 className={`text-lg font-medium${items.length === 0 ? ' opacity-40' : ''}`}>
        {title}
      </h4>
      {items.length > 0 && (
        <ul className={TILE_GRID}>
          {items.map((item) => (
            <InventoryTile key={item.uuid} item={item} daysLeft={item.daysLeft} measures={measures} onThrowAway={onThrowAway} />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function InventoryList() {
  // Wait for the active house before fetching: house-scoped calls need the
  // X-RCPLS-House-Id header, which is only known once houses have loaded. Keying
  // by house id also refetches if the user switches house.
  const activeHouse = useActiveHouse();
  const { data: items, error, isLoading, mutate } = useSWR(
    activeHouse ? ['/api/inventory', activeHouse.id] : null,
    () => fetcher('/api/inventory'),
  );
  const measures = useMeasures();
  const [throwingAway, setThrowingAway] = useState<InventoryItem | null>(null);
  const [showExpiration, setShowExpiration] = useState(false);

  if (!activeHouse || isLoading) {
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

  // Items with something left first (alphabetically), then fully-consumed
  // ones (also alphabetically) — greyed out below, rather than hidden.
  const pantryItems = [...items].sort((a, b) => {
    const aInactive = isFullyConsumed(a);
    const bInactive = isFullyConsumed(b);
    if (aInactive !== bInactive) return aInactive ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  // Nearest expiration first, regardless of consumption — fully-consumed
  // items stay in their true date bucket, just greyed out by InventoryTile,
  // same treatment as the alphabetical view.
  const withDaysLeft: ItemWithDaysLeft[] = [...items]
    .map((item) => ({ ...item, daysLeft: daysUntil(item.expiration) }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const expired = withDaysLeft.filter((item) => item.daysLeft < 0);
  const withinWeek = withDaysLeft.filter((item) => item.daysLeft >= 0 && item.daysLeft <= 7);
  const withinMonth = withDaysLeft.filter((item) => item.daysLeft > 7 && item.daysLeft <= 30);
  const later = withDaysLeft.filter((item) => item.daysLeft > 30);

  return (
    <>
      <Metadata title="Inventory" description="Your ingredient inventory" />

      <section className="grid gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xl font-semibold mr-auto">Inventory</h3>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showExpiration}
              onChange={(e) => setShowExpiration(e.target.checked)}
            />
            Show expiration
          </label>
        </div>

        {pantryItems.length === 0 ? (
          <p>No items in inventory</p>
        ) : showExpiration ? (
          <>
            <ExpirationSection title="Expired" items={expired} measures={measures} onThrowAway={setThrowingAway} />
            <ExpirationSection title="Within a week" items={withinWeek} measures={measures} onThrowAway={setThrowingAway} />
            <ExpirationSection title="Within a month" items={withinMonth} measures={measures} onThrowAway={setThrowingAway} />
            <ExpirationSection title="Later" items={later} measures={measures} onThrowAway={setThrowingAway} />
          </>
        ) : (
          <ul className={TILE_GRID}>
            {pantryItems.map((item) => (
              <InventoryTile key={item.uuid} item={item} measures={measures} onThrowAway={setThrowingAway} />
            ))}
          </ul>
        )}
      </section>

      {throwingAway && (
        <ThrowAwayPanel
          uuid={throwingAway.uuid}
          item={throwingAway}
          onSaved={() => mutate()}
          onClose={() => setThrowingAway(null)}
        />
      )}
    </>
  );
}
