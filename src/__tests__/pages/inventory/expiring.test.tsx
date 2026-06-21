import { render, screen } from '@testing-library/react';
import ExpiringInventory from '@/pages/inventory/expiring';

jest.mock('swr');
jest.mock('next/link', () => ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
  <a href={href} className={className}>{children}</a>
));
jest.mock('@/components/Metadata', () => () => null);

const useSWR = require('swr').default;

const measure: Measure = { measureId: 'ITEMS', singular: 'item', plural: 'items', short: 'item' };

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
  { uuid: 'uuid-1', name: 'Bread', measure, amount: 2, expiration: daysFromNow(20) },
  { uuid: 'uuid-2', name: 'Milk', measure, amount: 1, expiration: daysFromNow(-3) },
  { uuid: 'uuid-3', name: 'Eggs', measure, amount: 6, expiration: daysFromNow(3) },
  { uuid: 'uuid-4', name: 'Flour', measure, amount: 1, expiration: daysFromNow(90) },
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

  it('splits items into "next week" (including already-expired) and "next month" sections', () => {
    useSWR.mockReturnValue({ isLoading: false, data: mockItems, error: undefined });
    render(<ExpiringInventory />);

    const nextWeek = screen.getByRole('heading', { level: 4, name: 'In the next week' });
    const nextMonth = screen.getByRole('heading', { level: 4, name: 'In the next month' });
    expect(nextWeek).not.toHaveClass('opacity-40');
    expect(nextMonth).not.toHaveClass('opacity-40');

    // Milk (expired) and Eggs (3 days) belong in "next week"; Bread (20 days)
    // belongs in "next month"; Flour (90 days) is out of scope for this page.
    expect(screen.getAllByRole('heading', { level: 5 }).map((el) => el.textContent)).toEqual([
      'Milk', 'Eggs', 'Bread',
    ]);
    expect(screen.queryByText('Flour')).not.toBeInTheDocument();
  });

  it('greys out a section heading when nothing falls into it', () => {
    useSWR.mockReturnValue({
      isLoading: false,
      data: [{ uuid: 'uuid-1', name: 'Eggs', measure, amount: 6, expiration: daysFromNow(3) }],
      error: undefined,
    });
    render(<ExpiringInventory />);

    expect(screen.getByRole('heading', { level: 4, name: 'In the next week' })).not.toHaveClass('opacity-40');
    expect(screen.getByRole('heading', { level: 4, name: 'In the next month' })).toHaveClass('opacity-40');
  });

  it('shows days left instead of a raw date, and flags already-expired items', () => {
    useSWR.mockReturnValue({ isLoading: false, data: mockItems, error: undefined });
    render(<ExpiringInventory />);

    expect(screen.getByText('Expired 3 days ago')).toBeInTheDocument();
    expect(screen.getByText('3 days left')).toBeInTheDocument();
    expect(screen.getByText('20 days left')).toBeInTheDocument();
  });

  it('shows quantity for each item', () => {
    useSWR.mockReturnValue({ isLoading: false, data: mockItems, error: undefined });
    render(<ExpiringInventory />);
    expect(screen.getByText('6 items')).toBeInTheDocument();
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
