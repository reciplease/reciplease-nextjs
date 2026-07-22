import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import Metadata from '@/components/Metadata';
import InventoryImage from '@/components/InventoryImage';
import ThrowAwayPanel from '@/components/inventory/ThrowAwayPanel';
import { useMeasures, findMeasure } from '@/lib/measures';
import { apiFetch, useActiveHouse } from '@/lib/houses';

const fetcher = (url: string): Promise<InventoryItem[]> =>
  apiFetch(url).then((res) => res.json());

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Whole calendar days between today and the expiration date — negative once
// it's passed. `expiration` is built from its Y/M/D parts (not `new
// Date(expiration)`, which treats a date-only string as UTC midnight and can
// land on the wrong local calendar day) so this matches "today" in whatever
// timezone the browser is in, not UTC.
function daysUntil(expiration: string): number {
  const [year, month, day] = expiration.split('-').map(Number);
  const expiresAt = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((expiresAt.getTime() - today.getTime()) / MS_PER_DAY);
}

function formatDaysLeft(daysLeft: number): string {
  if (daysLeft > 1) return `${daysLeft} days left`;
  if (daysLeft === 1) return '1 day left';
  if (daysLeft === 0) return 'Expires today';
  if (daysLeft === -1) return 'Expired yesterday';
  return `Expired ${Math.abs(daysLeft)} days ago`;
}

// Red/amber/green by urgency: already-expired-or-expiring-imminently, due
// within the week, or comfortably further out.
function daysLeftColor(daysLeft: number): string {
  if (daysLeft <= 2) return 'text-red-600';
  if (daysLeft <= 7) return 'text-amber-600';
  return 'text-green-600';
}

type ItemWithDaysLeft = InventoryItem & { daysLeft: number };

function displayMeasure(item: InventoryItem, measures: Measure[]): string {
  const measure = findMeasure(item.measure, measures);
  if (!measure) return item.measure;
  return item.remaining === 1 ? measure.singular : measure.plural;
}

function ExpirationSection({
  title,
  items,
  measures,
  onThrowAway,
}: {
  title: string;
  items: ItemWithDaysLeft[];
  measures: Measure[];
  onThrowAway: (item: ItemWithDaysLeft) => void;
}) {
  return (
    <div>
      <h4 className={`text-lg font-medium${items.length === 0 ? ' opacity-40' : ''}`}>
        {title}
      </h4>
      {items.length > 0 && (
        <ul className="list-none p-0 grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-4 my-4">
          {items.map((item) => (
            <li key={item.uuid} className="relative">
              <Link
                href={`/inventory/${item.uuid}`}
                className="grid gap-2"
              >
                <InventoryImage
                  item={item}
                  className="w-full aspect-square object-cover rounded border border-[#ccc]"
                />
                <h5 className="font-medium text-center text-sm">{item.name}</h5>
                <p className="text-center text-xs text-[#666] -mt-1">
                  {item.remaining} {displayMeasure(item, measures)}
                </p>
                <p className={`text-center text-xs font-medium -mt-1 ${daysLeftColor(item.daysLeft)}`}>
                  {formatDaysLeft(item.daysLeft)}
                </p>
              </Link>
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ExpiringInventory() {
  const activeHouse = useActiveHouse();
  const { data: items, error, isLoading, mutate } = useSWR(
    activeHouse ? ['/api/inventory?excludeFullyConsumed=true', activeHouse.id] : null,
    () => fetcher('/api/inventory?excludeFullyConsumed=true'),
  );
  const measures = useMeasures();
  const [throwingAway, setThrowingAway] = useState<ItemWithDaysLeft | null>(null);

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
        <Metadata title="Expiring soon" description="Inventory items by expiration date" />
        <p>Could not load inventory</p>
      </>
    );
  }

  // Fully-consumed items (nothing left to expire) are already excluded by the
  // backend (excludeFullyConsumed=true above) — unlike the pantry list, which
  // deliberately keeps them visible, greyed out, in case the user wants to
  // restock.
  const withDaysLeft = items
    .map((item) => ({ ...item, daysLeft: daysUntil(item.expiration) }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  // Already-expired items are folded into "next week" (more urgent than
  // anything still ahead, not a third bucket the user has to check too).
  const nextWeek = withDaysLeft.filter((item) => item.daysLeft <= 7);
  const nextMonth = withDaysLeft.filter((item) => item.daysLeft > 7 && item.daysLeft <= 30);

  return (
    <>
      <Metadata title="Expiring soon" description="Inventory items by expiration date" />

      <section className="grid gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xl font-semibold mr-auto">Expiring soon</h3>
          <Link href="/inventory" className="text-sm underline">← Pantry</Link>
        </div>

        {withDaysLeft.length === 0 ? (
          <p>No items in inventory</p>
        ) : (
          <>
            <ExpirationSection title="In the next week" items={nextWeek} measures={measures} onThrowAway={setThrowingAway} />
            <ExpirationSection title="In the next month" items={nextMonth} measures={measures} onThrowAway={setThrowingAway} />
          </>
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
