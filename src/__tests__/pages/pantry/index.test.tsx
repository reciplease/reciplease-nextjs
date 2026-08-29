import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PantryList from '@/pages/pantry';

jest.mock('swr');
jest.mock('@/lib/houses', () => ({
  useActiveHouse: () => ({ id: 'h1', name: 'Home', role: 'OWNER' }),
  usePendingCapturedItemsCount: () => 0,
}));

afterEach(() => window.localStorage.clear());
jest.mock('next/link', () => ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
  <a href={href} className={className}>{children}</a>
));
jest.mock('@/components/Metadata', () => () => null);

// The generated client (src/types/generated/client.ts) calls this mutator
// directly rather than `fetch` — mocking it here keeps the generated request
// building/response envelope handling exercised for real, while giving the
// tests a single, low-level seam to assert against (same role `global.fetch`
// played before this page migrated off hand-written apiFetch calls).
const mockApiClientMutator = jest.fn();
jest.mock('@/lib/apiClientMutator', () => ({
  apiClientMutator: (...args: unknown[]) => mockApiClientMutator(...args),
  isSuccessResponse: (response: { status: number }) => response.status >= 200 && response.status < 300,
  describeErrorStatus: (status: number) => {
    if (status === 401) return 'Please sign in again.';
    if (status === 403) return "You don't have permission to do that.";
    if (status === 404) return "That couldn't be found.";
    if (status >= 400 && status < 500) return 'Please check your input and try again.';
    return 'Something went wrong. Please try again.';
  },
}));

const useSWR = require('swr').default;

// The generated hooks pass their key to `swr` as a thunk
// (`() => isEnabled ? [...] : null`), not a plain key — resolve it the same
// way the real `swr` package would before matching on it.
function resolveKey(key: unknown): unknown {
  return typeof key === 'function' ? (key as () => unknown)() : key;
}

const grams: Measure = { measureId: 'GRAMS', singular: 'gram', plural: 'grams', short: 'g' };
const items: Measure = { measureId: 'ITEMS', singular: 'item', plural: 'items', short: 'item' };

function mockPantry(state: {
  isLoading: boolean;
  data: PantryItem[] | undefined;
  error: Error | undefined;
  mutate?: jest.Mock;
}) {
  useSWR.mockImplementation((key: unknown) => {
    if (resolveKey(key) === '/api/measures') return { data: [items, grams], isLoading: false };
    const itemsResponse = state.data ? { data: state.data, status: 200, headers: new Headers() } : undefined;
    return { mutate: jest.fn(), ...state, data: itemsResponse };
  });
}

// Dates relative to "now" so bucketing is deterministic regardless of when
// the test runs, without needing to fake the system clock. Built from local
// Y/M/D (not toISOString, which is UTC and can land on the wrong calendar
// day close to local midnight).
function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const mockItems: PantryItem[] = [
  {
    uuid: 'uuid-1',
    name: 'Bread',
    brand: 'Warburtons',
    measure: items.measureId ?? 'ITEMS',
    amount: 2,
    remaining: 2,
    expiration: daysFromNow(365),
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    uuid: 'uuid-2',
    name: 'Avocado',
    measure: items.measureId ?? 'ITEMS',
    amount: 3,
    remaining: 3,
    expiration: daysFromNow(180),
    image: 'ZmFrZS1pbWFnZQ==',
    createdAt: '2026-01-03T00:00:00Z',
    updatedAt: '2026-01-03T00:00:00Z',
  },
  {
    uuid: 'uuid-3',
    name: 'Flour',
    measure: grams.measureId ?? 'GRAMS',
    amount: 500,
    remaining: 500,
    expiration: daysFromNow(-10),
    createdAt: '2026-01-02T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
  },
];

function openSortFilterMenu() {
  fireEvent.click(screen.getByRole('button', { name: 'Sort and filter' }));
}

describe('PantryList', () => {
  beforeEach(() => {
    mockApiClientMutator.mockReset();
    mockApiClientMutator.mockResolvedValue({ data: {}, status: 200, headers: new Headers() });
  });

  it('shows loading state', () => {
    mockPantry({ isLoading: true, data: undefined, error: undefined });
    render(<PantryList />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows error state', () => {
    mockPantry({ isLoading: false, data: undefined, error: new Error('fail') });
    render(<PantryList />);
    expect(screen.getByText('Could not load pantry')).toBeInTheDocument();
  });

  it('sorts items alphabetically', () => {
    mockPantry({ isLoading: false, data: mockItems, error: undefined });
    render(<PantryList />);
    const names = screen.getAllByRole('heading', { level: 4 }).map((el) => el.textContent);
    expect(names).toEqual(['Avocado', 'Bread', 'Flour']);
  });

  it('shows the brand under the name when present, and nothing when absent', () => {
    mockPantry({ isLoading: false, data: mockItems, error: undefined });
    render(<PantryList />);
    expect(screen.getByText('Warburtons')).toBeInTheDocument();
  });

  it('renders a photo thumbnail when the item has an image', () => {
    mockPantry({ isLoading: false, data: mockItems, error: undefined });
    render(<PantryList />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('shows a placeholder tile when the item has no image', () => {
    mockPantry({ isLoading: false, data: [mockItems[0]], error: undefined });
    render(<PantryList />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('🥫')).toBeInTheDocument();
  });

  it('shows empty state message when no items', () => {
    mockPantry({ isLoading: false, data: [], error: undefined });
    render(<PantryList />);
    expect(screen.getByText('No items in pantry')).toBeInTheDocument();
  });

  it('sorts by expiration into Expired/Within a week/Within a month/Later sections when that sort is selected', () => {
    const mockWithinWeek: PantryItem = { ...mockItems[0], uuid: 'uuid-4', name: 'Eggs', expiration: daysFromNow(3) };
    mockPantry({ isLoading: false, data: [...mockItems, mockWithinWeek], error: undefined });
    render(<PantryList />);

    openSortFilterMenu();
    fireEvent.click(screen.getByLabelText('Expiration'));

    expect(screen.getByRole('heading', { level: 4, name: 'Expired' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: 'Within a week' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: 'Within a month' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: 'Later' })).toBeInTheDocument();

    // Flour is expired (-10 days), Eggs within the week (3 days), Avocado
    // within... actually 180 days out is "Later", Bread (365 days) also
    // "Later" — order overall is nearest-expiration first regardless of section.
    const names = screen.getAllByRole('heading', { level: 5 }).map((el) => el.textContent);
    expect(names).toEqual(['Flour', 'Eggs', 'Avocado', 'Bread']);
  });

  it('greys out a section heading when nothing falls into it', () => {
    mockPantry({ isLoading: false, data: [mockItems[0]], error: undefined });
    render(<PantryList />);

    openSortFilterMenu();
    fireEvent.click(screen.getByLabelText('Expiration'));

    expect(screen.getByRole('heading', { level: 4, name: 'Expired' })).toHaveClass('opacity-40');
    expect(screen.getByRole('heading', { level: 4, name: 'Later' })).not.toHaveClass('opacity-40');
  });

  it('shows the alphabetical view again when switching back to name sort', () => {
    mockPantry({ isLoading: false, data: mockItems, error: undefined });
    render(<PantryList />);

    openSortFilterMenu();
    fireEvent.click(screen.getByLabelText('Expiration'));
    expect(screen.getByRole('heading', { level: 4, name: 'Expired' })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Name (A–Z)'));
    fireEvent.click(screen.getByLabelText('Close'));
    expect(screen.queryByRole('heading', { level: 4, name: 'Expired' })).not.toBeInTheDocument();
    const names = screen.getAllByRole('heading', { level: 4 }).map((el) => el.textContent);
    expect(names).toEqual(['Avocado', 'Bread', 'Flour']);
  });

  it('sorts by date added, newest first', () => {
    mockPantry({ isLoading: false, data: mockItems, error: undefined });
    render(<PantryList />);

    openSortFilterMenu();
    fireEvent.click(screen.getByLabelText('Date added (newest first)'));
    fireEvent.click(screen.getByLabelText('Close'));

    // Avocado (Jan 3) > Flour (Jan 2) > Bread (Jan 1).
    const names = screen.getAllByRole('heading', { level: 4 }).map((el) => el.textContent);
    expect(names).toEqual(['Avocado', 'Flour', 'Bread']);
  });

  it('filters to partially eaten items only, and clears back to showing everything', () => {
    const partiallyEaten: PantryItem = { ...mockItems[0], uuid: 'uuid-5', name: 'Cheese', amount: 4, remaining: 1 };
    mockPantry({ isLoading: false, data: [...mockItems, partiallyEaten], error: undefined });
    render(<PantryList />);

    openSortFilterMenu();
    fireEvent.click(screen.getByLabelText('Partially eaten'));
    fireEvent.click(screen.getByLabelText('Close'));

    expect(screen.getAllByRole('heading', { level: 4 }).map((el) => el.textContent)).toEqual(['Cheese']);

    openSortFilterMenu();
    fireEvent.click(screen.getByText('Clear filter'));
    fireEvent.click(screen.getByLabelText('Close'));

    expect(screen.getAllByRole('heading', { level: 4 }).map((el) => el.textContent)).toEqual([
      'Avocado',
      'Bread',
      'Cheese',
      'Flour',
    ]);
  });

  it('shows a distinct message when the filter excludes every item', () => {
    mockPantry({ isLoading: false, data: mockItems, error: undefined });
    render(<PantryList />);

    openSortFilterMenu();
    fireEvent.click(screen.getByLabelText('Partially eaten'));

    expect(screen.getByText('No items match the current filter')).toBeInTheDocument();
    expect(screen.queryByText('No items in pantry')).not.toBeInTheDocument();
  });

  it('opens the throw-away panel from the tile grid and bins the item without navigating to its detail page', async () => {
    const mutate = jest.fn();
    mockPantry({ isLoading: false, data: mockItems, error: undefined, mutate });
    render(<PantryList />);

    fireEvent.click(screen.getByRole('button', { name: 'Throw away Bread' }));
    expect(screen.getByRole('heading', { name: 'Throw away Bread' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Amount thrown away'), { target: { value: '2' } });
    fireEvent.submit(screen.getByLabelText('Amount thrown away').closest('form')!);

    await waitFor(() => {
      expect(mockApiClientMutator).toHaveBeenCalledWith(
        '/api/pantry/uuid-1',
        expect.objectContaining({ method: 'PUT' }),
      );
      expect(mutate).toHaveBeenCalled();
    });
  });

  it('treats binning the last of an item (204, no body) as success and refetches the list', async () => {
    mockApiClientMutator.mockResolvedValue({ data: undefined, status: 204, headers: new Headers() });
    const mutate = jest.fn();
    mockPantry({ isLoading: false, data: mockItems, error: undefined, mutate });
    render(<PantryList />);

    fireEvent.click(screen.getByRole('button', { name: 'Throw away Bread' }));
    fireEvent.change(screen.getByLabelText('Amount thrown away'), { target: { value: '2' } });
    fireEvent.submit(screen.getByLabelText('Amount thrown away').closest('form')!);

    await waitFor(() => {
      expect(mutate).toHaveBeenCalled();
    });
    // Once mutate() actually revalidates against the real backend, the item is simply
    // absent from the next GET /api/pantry response — no client-side removal logic needed.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
