import { useState } from 'react';
import Link from 'next/link';
import Metadata from '@/components/Metadata';
import PantryImage from '@/components/PantryImage';
import ThrowAwayPanel from '@/components/pantry/ThrowAwayPanel';
import SortFilterMenu, {
  DEFAULT_PANTRY_FILTERS,
  type PantryFilters,
  type PantrySortBy,
} from '@/components/pantry/SortFilterMenu';
import { useActiveHouse, usePendingCapturedItemsCount } from '@/lib/houses';
import { useMeasures, findMeasure } from '@/lib/measures';
import { daysUntil, formatDaysLeft, daysLeftColor } from '@/lib/pantry';
import { usePersistentState } from '@/lib/usePersistentState';
import { useFindAllPantryItems } from '@/types/generated/client';
import { isSuccessResponse } from '@/lib/apiClientMutator';

const sortFilterIconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

// Sliders glyph — matches the stroke style Header.tsx uses for its nav icons.
function SortFilterIcon() {
  return (
    <svg {...sortFilterIconProps}>
      <line x1="4" y1="6" x2="20" y2="6" />
      <circle cx="9" cy="6" r="2" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <circle cx="15" cy="12" r="2" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="9" cy="18" r="2" />
    </svg>
  );
}

type ItemWithDaysLeft = PantryItem & { daysLeft: number };

function displayMeasure(item: PantryItem, measures: Measure[]): string {
  const measure = findMeasure(item.measure, measures);
  if (!measure) return item.measure;
  return item.remaining === 1 ? measure.singular : measure.plural;
}

function PantryTile({
  item,
  daysLeft,
  measures,
  onThrowAway,
}: {
  item: PantryItem;
  daysLeft?: number;
  measures: Measure[];
  onThrowAway: (item: PantryItem) => void;
}) {
  // Every tile is the same fixed height regardless of how much text it holds
  // (long names, a brand line, a days-left line) — the image is the one
  // flexible element (flex-1 + min-h-0) and shrinks to make room for text,
  // rather than letting a longer name blow the tile taller than its neighbors.
  return (
    <li className="relative">
      <Link href={`/pantry/${item.uuid}`} className="flex flex-col gap-2 h-60">
        <div className="flex-1 min-h-0">
          <PantryImage
            item={item}
            className="w-full h-full object-cover rounded border border-[#ccc]"
          />
        </div>
        <div className="shrink-0">
          {daysLeft === undefined ? (
            <h4 className="font-medium text-center text-sm line-clamp-2">{item.name}</h4>
          ) : (
            <h5 className="font-medium text-center text-sm line-clamp-2">{item.name}</h5>
          )}
          {item.brand && <p className="text-center text-xs text-[#666]">{item.brand}</p>}
          {daysLeft !== undefined && (
            <>
              <p className="text-center text-xs text-[#666]">
                {item.remaining} {displayMeasure(item, measures)}
              </p>
              <p className={`text-center text-xs font-medium ${daysLeftColor(daysLeft)}`}>
                {formatDaysLeft(daysLeft)}
              </p>
            </>
          )}
        </div>
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
  onThrowAway: (item: PantryItem) => void;
}) {
  return (
    <div>
      <h4 className={`text-lg font-medium${items.length === 0 ? ' opacity-40' : ''}`}>
        {title}
      </h4>
      {items.length > 0 && (
        <ul className={TILE_GRID}>
          {items.map((item) => (
            <PantryTile key={item.uuid} item={item} daysLeft={item.daysLeft} measures={measures} onThrowAway={onThrowAway} />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PantryList() {
  // Wait for the active house before fetching: house-scoped calls need the
  // X-RCPLS-House-Id header, which is only known once houses have loaded. Keying
  // by house id also refetches if the user switches house.
  const activeHouse = useActiveHouse();
  // Note: the generated hook's cache key isn't house-scoped (unlike the
  // hand-written `[url, houseId]` key this replaced) — switching house no
  // longer forces a refetch here. Left as-is per the migration's accepted
  // key-shape trade-off.
  const { data: itemsResponse, error, isLoading, mutate } = useFindAllPantryItems(undefined, {
    swr: { enabled: Boolean(activeHouse) },
  });
  const items = itemsResponse && isSuccessResponse(itemsResponse) ? itemsResponse.data : undefined;
  const itemsError = error || (itemsResponse && !isSuccessResponse(itemsResponse));
  const measures = useMeasures();
  const pendingCapturedCount = usePendingCapturedItemsCount();
  const [throwingAway, setThrowingAway] = useState<PantryItem | null>(null);
  const [sortFilterMenuOpen, setSortFilterMenuOpen] = useState(false);
  const [sortBy, setSortBy] = usePersistentState<PantrySortBy>('pantry:sortBy', 'name');
  const [filters, setFilters] = usePersistentState<PantryFilters>('pantry:filters', DEFAULT_PANTRY_FILTERS);

  if (!activeHouse || isLoading) {
    return (
      <>
        <Metadata title="Loading Pantry" description="Loading pantry..." />
        <p>Loading...</p>
      </>
    );
  }

  if (itemsError || !items) {
    return (
      <>
        <Metadata title="Pantry" description="Your ingredient pantry" />
        <p>Could not load pantry</p>
      </>
    );
  }

  // A fully-consumed item is deleted server-side (see binPantryItem), so
  // every item the list ever sees still has something left — "partially
  // eaten" is just remaining < the original amount, not a separate flag.
  const filteredItems = filters.partiallyEaten ? items.filter((item) => item.remaining < item.amount) : items;

  const pantryItems = [...filteredItems].sort((a, b) => a.name.localeCompare(b.name));

  // Newest first — createdAt is always set server-side (Mongo's @CreatedDate),
  // so this only falls back to 0 (i.e. sorts last) for the pathological case
  // of a document written before that field existed.
  const newestFirst = [...filteredItems].sort(
    (a, b) => (b.createdAt ? Date.parse(b.createdAt) : 0) - (a.createdAt ? Date.parse(a.createdAt) : 0),
  );

  // Nearest expiration first. Items with no expiration date sort last —
  // there's nothing to go stale, so they're never urgent.
  const withDaysLeft: ItemWithDaysLeft[] = [...filteredItems]
    .map((item) => ({ ...item, daysLeft: item.expiration ? daysUntil(item.expiration) : Infinity }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const expired = withDaysLeft.filter((item) => item.daysLeft < 0);
  const withinWeek = withDaysLeft.filter((item) => item.daysLeft >= 0 && item.daysLeft <= 7);
  const withinMonth = withDaysLeft.filter((item) => item.daysLeft > 7 && item.daysLeft <= 30);
  const later = withDaysLeft.filter((item) => item.daysLeft > 30);

  return (
    <>
      <Metadata title="Pantry" description="Your ingredient pantry" />

      <section className="grid gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xl font-semibold mr-auto">Pantry</h3>
          {pendingCapturedCount > 0 && (
            <Link
              href="/pantry/shop/process"
              className="inline-flex items-center gap-1.5 rounded-full bg-highlight px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:brightness-110"
            >
              Process {pendingCapturedCount} captured {pendingCapturedCount === 1 ? 'item' : 'items'}
            </Link>
          )}
          <button
            type="button"
            aria-label="Sort and filter"
            title="Sort and filter"
            onClick={() => setSortFilterMenuOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full border-0 bg-transparent p-0 leading-none"
          >
            <SortFilterIcon />
          </button>
        </div>

        {items.length === 0 ? (
          <p>No items in pantry</p>
        ) : pantryItems.length === 0 ? (
          <p>No items match the current filter</p>
        ) : sortBy === 'expiration' ? (
          <>
            <ExpirationSection title="Expired" items={expired} measures={measures} onThrowAway={setThrowingAway} />
            <ExpirationSection title="Within a week" items={withinWeek} measures={measures} onThrowAway={setThrowingAway} />
            <ExpirationSection title="Within a month" items={withinMonth} measures={measures} onThrowAway={setThrowingAway} />
            <ExpirationSection title="Later" items={later} measures={measures} onThrowAway={setThrowingAway} />
          </>
        ) : (
          <ul className={TILE_GRID}>
            {(sortBy === 'dateAdded' ? newestFirst : pantryItems).map((item) => (
              <PantryTile key={item.uuid} item={item} measures={measures} onThrowAway={setThrowingAway} />
            ))}
          </ul>
        )}
      </section>

      {sortFilterMenuOpen && (
        <SortFilterMenu
          sortBy={sortBy}
          onSortByChange={setSortBy}
          filters={filters}
          onFiltersChange={setFilters}
          onClose={() => setSortFilterMenuOpen(false)}
        />
      )}

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
