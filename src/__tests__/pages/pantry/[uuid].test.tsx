import { render, screen } from '@testing-library/react';
import PantryItemPage from '@/pages/pantry/[uuid]';

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
// The eat flow (FAB + log-eaten panel, including Google Health matching) is exercised
// in its own test suite (src/__tests__/components/pantry/EatFlow.test.tsx);
// stub it here so this page's tests stay about data fetching/display.
jest.mock('@/components/pantry/EatFlow', () => ({ item }: { item: PantryItem }) => (
  <div data-testid="eat-flow">eat-flow for {item.name}</div>
));
jest.mock('@/components/pantry/ThrowAwayFlow', () => ({ item }: { item: PantryItem }) => (
  <div data-testid="throw-away-flow">throw-away-flow for {item.name}</div>
));

const useSWR = require('swr').default;
const useRouter = require('next/router').useRouter as jest.Mock;
global.fetch = jest.fn();

const ML: Measure = { measureId: 'ml', singular: 'millilitre', plural: 'millilitres', short: 'ml' };

const item: PantryItem = {
  uuid: 'uuid-1',
  name: 'Milk',
  measure: 'ml',
  amount: 500,
  remaining: 500,
  expiration: '2099-12-31',
};

const mutate = jest.fn();

function mockItem(state: { isLoading?: boolean; data?: PantryItem; error?: unknown }) {
  useSWR.mockImplementation((key: string) => {
    if (key === '/api/measures') return { data: [ML], isLoading: false };
    return { isLoading: false, data: undefined, error: undefined, mutate, ...state };
  });
}

describe('PantryItemPage', () => {
  const push = jest.fn();
  const replace = jest.fn();

  beforeEach(() => {
    (fetch as jest.Mock).mockReset();
    push.mockReset();
    replace.mockReset();
    mutate.mockReset();
    useRouter.mockReturnValue({ push, replace, isReady: true, query: { uuid: 'uuid-1' } });
  });

  it('shows loading state', () => {
    mockItem({ isLoading: true });
    render(<PantryItemPage />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('redirects to the pantry list when the item errors (e.g. deleted/not found)', () => {
    mockItem({ error: new Error('fail') });
    render(<PantryItemPage />);
    expect(screen.getByText(/no longer exists/)).toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith('/pantry');
  });

  it('renders item name and amount remaining out of the full amount', () => {
    mockItem({ data: item });
    render(<PantryItemPage />);
    expect(screen.getByText('Milk')).toBeInTheDocument();
    expect(screen.queryByText('Arla')).not.toBeInTheDocument();
    expect(screen.getByText(/500 of 500 millilitres/)).toBeInTheDocument();
  });

  it('shows the brand under the name when present', () => {
    mockItem({ data: { ...item, brand: 'Arla' } });
    render(<PantryItemPage />);
    expect(screen.getByText('Arla')).toBeInTheDocument();
  });

  it('shows singular measure when amount is 1', () => {
    mockItem({ data: { ...item, amount: 1, remaining: 1 } });
    render(<PantryItemPage />);
    expect(screen.getByText(/1 of 1 millilitre\b/)).toBeInTheDocument();
  });

  it('shows the expiration date localized, not as a raw ISO string', () => {
    mockItem({ data: item });
    render(<PantryItemPage />);
    expect(screen.queryByText(/2099-12-31/)).not.toBeInTheDocument();
    expect(screen.getByText(/Dec.*2099|2099.*Dec/)).toBeInTheDocument();
  });

  it('flags an expired item', () => {
    mockItem({ data: { ...item, expiration: '2000-01-01' } });
    render(<PantryItemPage />);
    expect(screen.getByText(/— expired/)).toBeInTheDocument();
  });

  it('renders the eat flow for the loaded item', () => {
    mockItem({ data: item });
    render(<PantryItemPage />);
    expect(screen.getByTestId('eat-flow')).toHaveTextContent('eat-flow for Milk');
  });

  it('renders the throw-away flow for the loaded item', () => {
    mockItem({ data: item });
    render(<PantryItemPage />);
    expect(screen.getByTestId('throw-away-flow')).toHaveTextContent('throw-away-flow for Milk');
  });

  it('hides both flows once nothing is left — there is nothing to eat or bin', () => {
    mockItem({ data: { ...item, remaining: 0 } });
    render(<PantryItemPage />);
    expect(screen.queryByTestId('eat-flow')).not.toBeInTheDocument();
    expect(screen.queryByTestId('throw-away-flow')).not.toBeInTheDocument();
  });
});
