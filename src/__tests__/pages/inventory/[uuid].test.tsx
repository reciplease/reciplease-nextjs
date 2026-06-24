import { render, screen } from '@testing-library/react';
import InventoryItemPage from '@/pages/inventory/[uuid]';

jest.mock('swr');
jest.mock('@/lib/houses', () => ({
  useActiveHouse: () => ({ id: 'h1', name: 'Home', role: 'OWNER' }),
  apiFetch: (url: string, init?: RequestInit) => fetch(url, init),
}));
jest.mock('next/link', () => ({ children, href }: { children: React.ReactNode; href: string }) => (
  <a href={href}>{children}</a>
));
jest.mock('@/components/Metadata', () => () => null);

const useSWR = require('swr').default;

const ML: Measure = { measureId: 'ml', singular: 'millilitre', plural: 'millilitres', short: 'ml' };

const item: InventoryItem = {
  uuid: 'uuid-1',
  name: 'Milk',
  measure: 'ml',
  amount: 500,
  expiration: '2099-12-31',
};

function mockItem(state: { isLoading?: boolean; data?: InventoryItem; error?: unknown }) {
  useSWR.mockImplementation((key: string) => {
    if (key === '/api/measures') return { data: [ML], isLoading: false };
    return { isLoading: false, data: undefined, error: undefined, ...state };
  });
}

describe('InventoryItemPage', () => {
  it('shows loading state', () => {
    mockItem({ isLoading: true });
    render(<InventoryItemPage uuid="uuid-1" />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows not found when error', () => {
    mockItem({ error: new Error('fail') });
    render(<InventoryItemPage uuid="uuid-1" />);
    expect(screen.getByText('Item not found')).toBeInTheDocument();
  });

  it('renders item name and amount', () => {
    mockItem({ data: item });
    render(<InventoryItemPage uuid="uuid-1" />);
    expect(screen.getByText('Milk')).toBeInTheDocument();
    expect(screen.getByText(/500 millilitres/)).toBeInTheDocument();
  });

  it('shows singular measure when amount is 1', () => {
    mockItem({ data: { ...item, amount: 1 } });
    render(<InventoryItemPage uuid="uuid-1" />);
    expect(screen.getByText(/1 millilitre/)).toBeInTheDocument();
  });

  it('shows the expiration date localized, not as a raw ISO string', () => {
    mockItem({ data: item });
    render(<InventoryItemPage uuid="uuid-1" />);
    expect(screen.queryByText(/2099-12-31/)).not.toBeInTheDocument();
    expect(screen.getByText(/Dec.*2099|2099.*Dec/)).toBeInTheDocument();
  });

  it('flags an expired item', () => {
    mockItem({ data: { ...item, expiration: '2000-01-01' } });
    render(<InventoryItemPage uuid="uuid-1" />);
    expect(screen.getByText(/— expired/)).toBeInTheDocument();
  });
});
