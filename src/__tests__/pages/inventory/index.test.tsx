import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InventoryList from '@/pages/inventory';

jest.mock('swr');
jest.mock('@/lib/houses', () => ({
  useActiveHouse: () => ({ id: 'h1', name: 'Home', role: 'OWNER' }),
  apiFetch: (url: string, init?: RequestInit) => fetch(url, init),
}));

global.fetch = jest.fn();
jest.mock('next/link', () => ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
  <a href={href} className={className}>{children}</a>
));
jest.mock('@/components/Metadata', () => () => null);

const useSWR = require('swr').default;

const grams: Measure = { measureId: 'GRAMS', singular: 'gram', plural: 'grams', short: 'g' };
const items: Measure = { measureId: 'ITEMS', singular: 'item', plural: 'items', short: 'item' };

function mockInventory(state: {
  isLoading: boolean;
  data: InventoryItem[] | undefined;
  error: Error | undefined;
  mutate?: jest.Mock;
}) {
  useSWR.mockImplementation((key: unknown) => {
    if (key === '/api/measures') return { data: [items, grams], isLoading: false };
    return { mutate: jest.fn(), ...state };
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

const mockItems: InventoryItem[] = [
  {
    uuid: 'uuid-1',
    name: 'Bread',
    measure: items.measureId,
    amount: 2,
    remaining: 2,
    expiration: daysFromNow(365),
  },
  {
    uuid: 'uuid-2',
    name: 'Avocado',
    measure: items.measureId,
    amount: 3,
    remaining: 3,
    expiration: daysFromNow(180),
    image: 'ZmFrZS1pbWFnZQ==',
  },
  {
    uuid: 'uuid-3',
    name: 'Flour',
    measure: grams.measureId,
    amount: 500,
    remaining: 500,
    expiration: daysFromNow(-10),
  },
];

describe('InventoryList', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockReset();
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
  });

  it('shows loading state', () => {
    mockInventory({ isLoading: true, data: undefined, error: undefined });
    render(<InventoryList />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows error state', () => {
    mockInventory({ isLoading: false, data: undefined, error: new Error('fail') });
    render(<InventoryList />);
    expect(screen.getByText('Could not load inventory')).toBeInTheDocument();
  });

  it('sorts items alphabetically', () => {
    mockInventory({ isLoading: false, data: mockItems, error: undefined });
    render(<InventoryList />);
    const names = screen.getAllByRole('heading', { level: 4 }).map((el) => el.textContent);
    expect(names).toEqual(['Avocado', 'Bread', 'Flour']);
  });

  it('renders a photo thumbnail when the item has an image', () => {
    mockInventory({ isLoading: false, data: mockItems, error: undefined });
    render(<InventoryList />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('shows a placeholder tile when the item has no image', () => {
    mockInventory({ isLoading: false, data: [mockItems[0]], error: undefined });
    render(<InventoryList />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('🥫')).toBeInTheDocument();
  });

  it('shows empty state message when no items', () => {
    mockInventory({ isLoading: false, data: [], error: undefined });
    render(<InventoryList />);
    expect(screen.getByText('No items in inventory')).toBeInTheDocument();
  });

  it('sorts by expiration into Expired/Within a week/Within a month/Later sections when the toggle is on', () => {
    const mockWithinWeek: InventoryItem = { ...mockItems[0], uuid: 'uuid-4', name: 'Eggs', expiration: daysFromNow(3) };
    mockInventory({ isLoading: false, data: [...mockItems, mockWithinWeek], error: undefined });
    render(<InventoryList />);

    fireEvent.click(screen.getByLabelText('Show expiration'));

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
    mockInventory({ isLoading: false, data: [mockItems[0]], error: undefined });
    render(<InventoryList />);

    fireEvent.click(screen.getByLabelText('Show expiration'));

    expect(screen.getByRole('heading', { level: 4, name: 'Expired' })).toHaveClass('opacity-40');
    expect(screen.getByRole('heading', { level: 4, name: 'Later' })).not.toHaveClass('opacity-40');
  });

  it('shows the alphabetical view again when the toggle is switched off', () => {
    mockInventory({ isLoading: false, data: mockItems, error: undefined });
    render(<InventoryList />);

    const toggle = screen.getByLabelText('Show expiration');
    fireEvent.click(toggle);
    expect(screen.getByRole('heading', { level: 4, name: 'Expired' })).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.queryByRole('heading', { level: 4, name: 'Expired' })).not.toBeInTheDocument();
    const names = screen.getAllByRole('heading', { level: 4 }).map((el) => el.textContent);
    expect(names).toEqual(['Avocado', 'Bread', 'Flour']);
  });

  it('opens the throw-away panel from the tile grid and bins the item without navigating to its detail page', async () => {
    const mutate = jest.fn();
    mockInventory({ isLoading: false, data: mockItems, error: undefined, mutate });
    render(<InventoryList />);

    fireEvent.click(screen.getByRole('button', { name: 'Throw away Bread' }));
    expect(screen.getByRole('heading', { name: 'Throw away Bread' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Amount thrown away'), { target: { value: '2' } });
    fireEvent.submit(screen.getByLabelText('Amount thrown away').closest('form')!);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/inventory/uuid-1',
        expect.objectContaining({ method: 'PUT' }),
      );
      expect(mutate).toHaveBeenCalled();
    });
  });

  it('treats binning the last of an item (204, no body) as success and refetches the list', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: true, status: 204, json: async () => ({}) });
    const mutate = jest.fn();
    mockInventory({ isLoading: false, data: mockItems, error: undefined, mutate });
    render(<InventoryList />);

    fireEvent.click(screen.getByRole('button', { name: 'Throw away Bread' }));
    fireEvent.change(screen.getByLabelText('Amount thrown away'), { target: { value: '2' } });
    fireEvent.submit(screen.getByLabelText('Amount thrown away').closest('form')!);

    await waitFor(() => {
      expect(mutate).toHaveBeenCalled();
    });
    // Once mutate() actually revalidates against the real backend, the item is simply
    // absent from the next GET /api/inventory response — no client-side removal logic needed.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
