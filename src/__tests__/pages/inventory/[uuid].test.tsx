import { render, screen } from '@testing-library/react';
import InventoryItemPage from '@/pages/inventory/[uuid]';

jest.mock('swr');
jest.mock('@/lib/houses', () => ({
  useActiveHouse: () => ({ id: 'h1', name: 'Home', role: 'OWNER' }),
  apiFetch: (url: string, init?: RequestInit) => fetch(url, init),
}));
jest.mock('next/router', () => ({ useRouter: jest.fn() }));
jest.mock('next/link', () => ({ children, href }: { children: React.ReactNode; href: string }) => (
  <a href={href}>{children}</a>
));
jest.mock('@/components/Metadata', () => () => null);
// The eat flow (FAB + log-eaten panel, including Fitbit matching) is exercised
// in its own test suite (src/__tests__/components/inventory/EatFlow.test.tsx);
// stub it here so this page's tests stay about data fetching/display.
jest.mock('@/components/inventory/EatFlow', () => ({ item }: { item: InventoryItem }) => (
  <div data-testid="eat-flow">eat-flow for {item.name}</div>
));

const useSWR = require('swr').default;
const useRouter = require('next/router').useRouter as jest.Mock;
global.fetch = jest.fn();

const ML: Measure = { measureId: 'ml', singular: 'millilitre', plural: 'millilitres', short: 'ml' };

const item: InventoryItem = {
  uuid: 'uuid-1',
  name: 'Milk',
  measure: 'ml',
  amount: 500,
  remaining: 500,
  expiration: '2099-12-31',
};

const mutate = jest.fn();

function mockItem(state: { isLoading?: boolean; data?: InventoryItem; error?: unknown }) {
  useSWR.mockImplementation((key: string) => {
    if (key === '/api/measures') return { data: [ML], isLoading: false };
    return { isLoading: false, data: undefined, error: undefined, mutate, ...state };
  });
}

describe('InventoryItemPage', () => {
  const push = jest.fn();

  beforeEach(() => {
    (fetch as jest.Mock).mockReset();
    push.mockReset();
    mutate.mockReset();
    useRouter.mockReturnValue({ push, isReady: true, query: { uuid: 'uuid-1' } });
  });

  it('shows loading state', () => {
    mockItem({ isLoading: true });
    render(<InventoryItemPage />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows not found when error', () => {
    mockItem({ error: new Error('fail') });
    render(<InventoryItemPage />);
    expect(screen.getByText('Item not found')).toBeInTheDocument();
  });

  it('renders item name and amount remaining out of the full amount', () => {
    mockItem({ data: item });
    render(<InventoryItemPage />);
    expect(screen.getByText('Milk')).toBeInTheDocument();
    expect(screen.getByText(/500 of 500 millilitres/)).toBeInTheDocument();
  });

  it('shows singular measure when amount is 1', () => {
    mockItem({ data: { ...item, amount: 1, remaining: 1 } });
    render(<InventoryItemPage />);
    expect(screen.getByText(/1 of 1 millilitre\b/)).toBeInTheDocument();
  });

  it('shows the expiration date localized, not as a raw ISO string', () => {
    mockItem({ data: item });
    render(<InventoryItemPage />);
    expect(screen.queryByText(/2099-12-31/)).not.toBeInTheDocument();
    expect(screen.getByText(/Dec.*2099|2099.*Dec/)).toBeInTheDocument();
  });

  it('flags an expired item', () => {
    mockItem({ data: { ...item, expiration: '2000-01-01' } });
    render(<InventoryItemPage />);
    expect(screen.getByText(/— expired/)).toBeInTheDocument();
  });

  it('renders the eat flow for the loaded item', () => {
    mockItem({ data: item });
    render(<InventoryItemPage />);
    expect(screen.getByTestId('eat-flow')).toHaveTextContent('eat-flow for Milk');
  });
});
