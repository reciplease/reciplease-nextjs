import { render, screen } from '@testing-library/react';
import ExpiringInventory from '@/pages/inventory/expiring';

jest.mock('swr');
jest.mock('next/link', () => ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
  <a href={href} className={className}>{children}</a>
));
jest.mock('@/components/Metadata', () => () => null);

const useSWR = require('swr').default;

const items: Measure = { measureId: 'ITEMS', singular: 'item', plural: 'items', short: 'item' };

const mockItems: InventoryItem[] = [
  { uuid: 'uuid-1', name: 'Bread', measure: items, amount: 2, expiration: '2099-12-31' },
  { uuid: 'uuid-2', name: 'Milk', measure: items, amount: 1, expiration: '2020-01-01' },
  { uuid: 'uuid-3', name: 'Eggs', measure: items, amount: 6, expiration: '2099-06-30' },
];

describe('ExpiringInventory', () => {
  it('shows loading state', () => {
    useSWR.mockReturnValue({ isLoading: true, data: undefined, error: undefined });
    render(<ExpiringInventory />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows error state', () => {
    useSWR.mockReturnValue({ isLoading: false, data: undefined, error: new Error('fail') });
    render(<ExpiringInventory />);
    expect(screen.getByText('Could not load inventory')).toBeInTheDocument();
  });

  it('sorts items soonest-expiry-first, including expired ones', () => {
    useSWR.mockReturnValue({ isLoading: false, data: mockItems, error: undefined });
    render(<ExpiringInventory />);
    const names = screen.getAllByRole('heading', { level: 4 }).map((el) => el.textContent);
    expect(names).toEqual(['Milk', 'Eggs', 'Bread']);
  });

  it('marks expired items', () => {
    useSWR.mockReturnValue({ isLoading: false, data: mockItems, error: undefined });
    render(<ExpiringInventory />);
    expect(screen.getByText(/expired/)).toBeInTheDocument();
  });

  it('shows quantity and expiration for each item', () => {
    useSWR.mockReturnValue({ isLoading: false, data: mockItems, error: undefined });
    render(<ExpiringInventory />);
    expect(screen.getByText('2 items')).toBeInTheDocument();
    expect(screen.getByText(/Expires: 2099-12-31/)).toBeInTheDocument();
  });

  it('links back to the pantry view', () => {
    useSWR.mockReturnValue({ isLoading: false, data: mockItems, error: undefined });
    render(<ExpiringInventory />);
    expect(screen.getByRole('link', { name: /pantry/i })).toHaveAttribute('href', '/inventory');
  });

  it('shows empty state message when no items', () => {
    useSWR.mockReturnValue({ isLoading: false, data: [], error: undefined });
    render(<ExpiringInventory />);
    expect(screen.getByText('No items in inventory')).toBeInTheDocument();
  });
});
