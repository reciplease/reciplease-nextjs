import { render, screen } from '@testing-library/react';
import InventoryList from '@/pages/inventory';

jest.mock('swr');
jest.mock('next/link', () => ({ children, href }: { children: React.ReactNode; href: string }) => (
  <a href={href}>{children}</a>
));
jest.mock('@/components/Metadata', () => () => null);

const useSWR = require('swr').default;

const grams: Measure = { measureId: 'GRAMS', singular: 'gram', plural: 'grams', short: 'g' };
const items: Measure = { measureId: 'ITEMS', singular: 'item', plural: 'items', short: 'item' };

const mockItems: InventoryItem[] = [
  {
    uuid: 'uuid-1',
    name: 'Bread',
    measure: items,
    amount: 2,
    expiration: '2099-12-31',
  },
  {
    uuid: 'uuid-2',
    name: 'Flour',
    measure: grams,
    amount: 500,
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

  it('renders inventory items', () => {
    useSWR.mockReturnValue({ isLoading: false, data: mockItems, error: undefined });
    render(<InventoryList />);
    expect(screen.getByText('Bread')).toBeInTheDocument();
    expect(screen.getByText('Flour')).toBeInTheDocument();
  });

  it('shows plural measure for amount > 1', () => {
    useSWR.mockReturnValue({ isLoading: false, data: mockItems, error: undefined });
    render(<InventoryList />);
    expect(screen.getByText('2 items')).toBeInTheDocument();
    expect(screen.getByText('500 grams')).toBeInTheDocument();
  });

  it('marks expired items', () => {
    useSWR.mockReturnValue({ isLoading: false, data: mockItems, error: undefined });
    render(<InventoryList />);
    expect(screen.getByText(/expired/)).toBeInTheDocument();
  });

  it('shows empty state message when no items', () => {
    useSWR.mockReturnValue({ isLoading: false, data: [], error: undefined });
    render(<InventoryList />);
    expect(screen.getByText('No items in inventory')).toBeInTheDocument();
  });
});
