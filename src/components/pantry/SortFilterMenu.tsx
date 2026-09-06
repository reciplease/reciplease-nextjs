import BottomSheet from '@/components/BottomSheet';

export type PantrySortBy = 'name' | 'dateAdded' | 'expiration';

export interface PantryFilters {
  partiallyEaten: boolean;
}

export const DEFAULT_PANTRY_FILTERS: PantryFilters = { partiallyEaten: false };

const SORT_OPTIONS: { value: PantrySortBy; label: string }[] = [
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'dateAdded', label: 'Date added (newest first)' },
  { value: 'expiration', label: 'Expiration' },
];

interface SortFilterMenuProps {
  sortBy: PantrySortBy;
  onSortByChange: (sortBy: PantrySortBy) => void;
  filters: PantryFilters;
  onFiltersChange: (filters: PantryFilters) => void;
  onClose: () => void;
}

// Replaces the old single "Show expiration" checkbox, which could only ever
// express one on/off view and had no room to grow (e.g. no way to add a filter
// alongside it).
export default function SortFilterMenu({ sortBy, onSortByChange, filters, onFiltersChange, onClose }: SortFilterMenuProps) {
  // Above the default z-50: PantryFab renders as a `z-50` sibling of the page
  // content, after it in the DOM — at equal z-index it would paint over this
  // modal's "Clear filter" button.
  return (
    <BottomSheet title="Sort &amp; filter" onClose={onClose} zIndex="z-[60]">
      <fieldset className="grid gap-2 border-0 p-0">
        <legend className="mb-1 text-sm font-medium">Sort by</legend>
        {SORT_OPTIONS.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="pantry-sort-by"
              value={option.value}
              checked={sortBy === option.value}
              onChange={() => onSortByChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>

      <fieldset className="mt-4 grid gap-2 border-0 p-0">
        <div className="flex items-center justify-between">
          <legend className="text-sm font-medium">Filter</legend>
          <button
            type="button"
            onClick={() => onFiltersChange(DEFAULT_PANTRY_FILTERS)}
            disabled={filters.partiallyEaten === DEFAULT_PANTRY_FILTERS.partiallyEaten}
            className="border-0 bg-transparent p-0 text-sm underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40"
          >
            Clear filter
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.partiallyEaten}
            onChange={(e) => onFiltersChange({ ...filters, partiallyEaten: e.target.checked })}
          />
          Partially eaten
        </label>
      </fieldset>
    </BottomSheet>
  );
}
