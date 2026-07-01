import { render, screen } from '@testing-library/react';
import ShoppingListPage from '@/pages/planner/shopping-list';

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

const mockShoppingList: ShoppingList = {
  items: [
    { name: 'flour', measure: 'g' as MeasureId, amount: 1100 },
    { name: 'bread', measure: 'item' as MeasureId, amount: 2 },
  ],
};

describe('ShoppingListPage', () => {
  it('shows loading state', () => {
    useSWR.mockReturnValue({ isLoading: true, data: undefined, error: undefined });
    render(<ShoppingListPage />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows error state', () => {
    useSWR.mockReturnValue({ isLoading: false, data: undefined, error: new Error('fail') });
    render(<ShoppingListPage />);
    expect(screen.getByText('Could not load the shopping list')).toBeInTheDocument();
  });

  it('shows an empty state when nothing is needed', () => {
    useSWR.mockReturnValue({ isLoading: false, data: { items: [] }, error: undefined });
    render(<ShoppingListPage />);
    expect(screen.getByText('Nothing to buy — everything planned is already covered')).toBeInTheDocument();
  });

  it('renders the gap items sorted alphabetically', () => {
    useSWR.mockReturnValue({ isLoading: false, data: mockShoppingList, error: undefined });
    render(<ShoppingListPage />);
    const items = screen.getAllByRole('listitem').map((el) => el.textContent);
    expect(items).toEqual(['2 itembread', '1100 gflour']);
  });
});
