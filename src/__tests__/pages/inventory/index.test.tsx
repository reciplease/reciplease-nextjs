import { render, screen } from '@testing-library/react';
import InventoryList from '@/pages/inventory';

jest.mock('swr');
jest.mock('@/lib/houses', () => ({
  useActiveHouse: () => ({ id: 'h1', name: 'Home', role: 'OWNER' }),
  apiFetch: (url: string, init?: RequestInit) => fetch(url, init),
}));
jest.mock('next/link', () => ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
  <a href={href} className={className}>{children}</a>
));
jest.mock('@/components/Metadata', () => () => null);

const useSWR = require('swr').default;

const grams: Measure = { measureId: 'GRAMS', singular: 'gram', plural: 'grams', short: 'g' };
const items: Measure = { measureId: 'ITEMS', singular: 'item', plural: 'items', short: 'item' };

const mockItems: InventoryItem[] = [
  {
    uuid: 'uuid-1',
    name: 'Bread',
    measure: items.measureId,
    amount: 2,
    remaining: 2,
    expiration: '2099-12-31',
  },
  {
    uuid: 'uuid-2',
    name: 'Avocado',
    measure: items.measureId,
    amount: 3,
    remaining: 3,
    expiration: '2099-06-30',
    image: 'ZmFrZS1pbWFnZQ==',
  },
  {
    uuid: 'uuid-3',
    name: 'Flour',
    measure: grams.measureId,
    amount: 500,
    remaining: 500,
    expiration: '2020-01-01',
  },
];

describe('InventoryList', () => {
  it('shows loading state', () => {
    useSWR.mockReturnValue({ isLoading: true, data: undefined, error: undefined });
    render(<InventoryList />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows error state', () => {
    useSWR.mockReturnValue({ isLoading: false, data: undefined, error: new Error('fail') });
    render(<InventoryList />);
    expect(screen.getByText('Could not load inventory')).toBeInTheDocument();
  });

  it('sorts items with something left alphabetically, with fully-consumed ones after', () => {
    useSWR.mockReturnValue({ isLoading: false, data: mockItems, error: undefined });
    render(<InventoryList />);
    const names = screen.getAllByRole('heading', { level: 4 }).map((el) => el.textContent);
    expect(names).toEqual(['Avocado', 'Bread', 'Flour']);
  });

  it('shows expired items like any other — they still need eating or binning', () => {
    useSWR.mockReturnValue({ isLoading: false, data: mockItems, error: undefined });
    render(<InventoryList />);
    const flourLink = screen.getByText('Flour').closest('a');
    expect(flourLink).not.toHaveClass('opacity-60');
  });

  it('shows a fully-consumed (but unexpired) item greyed out and sorted last, not deleted', () => {
    const eaten: InventoryItem = { ...mockItems[1], name: 'Zucchini', remaining: 0 };
    useSWR.mockReturnValue({ isLoading: false, data: [mockItems[0], eaten], error: undefined });
    render(<InventoryList />);

    const names = screen.getAllByRole('heading', { level: 4 }).map((el) => el.textContent);
    expect(names).toEqual(['Bread', 'Zucchini']);
    expect(screen.getByText('Zucchini').closest('a')).toHaveClass('opacity-60');
    expect(screen.getByText('Bread').closest('a')).not.toHaveClass('opacity-60');
  });

  it('renders a photo thumbnail when the item has an image', () => {
    useSWR.mockReturnValue({ isLoading: false, data: mockItems, error: undefined });
    render(<InventoryList />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('shows a placeholder tile when the item has no image', () => {
    useSWR.mockReturnValue({ isLoading: false, data: [mockItems[0]], error: undefined });
    render(<InventoryList />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('🥫')).toBeInTheDocument();
  });

  it('shows empty state message when no items', () => {
    useSWR.mockReturnValue({ isLoading: false, data: [], error: undefined });
    render(<InventoryList />);
    expect(screen.getByText('No items in inventory')).toBeInTheDocument();
  });

  it('links to the expiring-soon view', () => {
    useSWR.mockReturnValue({ isLoading: false, data: mockItems, error: undefined });
    render(<InventoryList />);
    expect(screen.getByRole('link', { name: /expiring soon/i })).toHaveAttribute('href', '/inventory/expiring');
  });
});
