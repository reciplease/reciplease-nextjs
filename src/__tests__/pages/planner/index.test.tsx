import { render, screen } from '@testing-library/react';
import Planner from '@/pages/planner/index';

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

const mockMeals: PlannedMeal[] = [
  {
    houseId: 'h1',
    name: 'Dinner',
    date: '2026-06-06',
    items: [
      { ingredient: { name: 'bread', measure: 'item' as MeasureId, amount: 2 }, allocations: [{ inventoryItemId: 'i1', amount: 2 }] },
      { ingredient: { name: 'butter', measure: 'g' as MeasureId, amount: 15 }, allocations: [] },
    ],
  },
  {
    houseId: 'h1',
    name: 'Leftover rice night',
    date: '2026-06-05',
    items: [],
  },
];

describe('Planner', () => {
  it('shows loading state', () => {
    useSWR.mockReturnValue({ isLoading: true, data: undefined, error: undefined });
    render(<Planner />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows error state', () => {
    useSWR.mockReturnValue({ isLoading: false, data: undefined, error: new Error('fail') });
    render(<Planner />);
    expect(screen.getByText('Could not load planned meals')).toBeInTheDocument();
  });

  it('shows an empty state when nothing is planned', () => {
    useSWR.mockReturnValue({ isLoading: false, data: [], error: undefined });
    render(<Planner />);
    expect(screen.getByText('No meals planned this week')).toBeInTheDocument();
  });

  it('renders planned meals sorted by date', () => {
    useSWR.mockReturnValue({ isLoading: false, data: mockMeals, error: undefined });
    render(<Planner />);
    const names = screen.getAllByRole('heading', { level: 4 }).map((el) => el.textContent);
    expect(names).toEqual(['Leftover rice night', 'Dinner']);
  });

  it('flags ingredients with no inventory allocation as to buy', () => {
    useSWR.mockReturnValue({ isLoading: false, data: mockMeals, error: undefined });
    render(<Planner />);
    expect(screen.getByText(/butter/)).toHaveTextContent('(to buy)');
    expect(screen.getByText(/bread/)).not.toHaveTextContent('(to buy)');
  });
});
