import { render, screen, fireEvent } from '@testing-library/react';
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
global.fetch = jest.fn();

const mockMeals: PlannedMeal[] = [
  {
    plannedMealId: 'meal-1',
    plannedMealShortId: 'meal-1-short',
    houseId: 'h1',
    name: 'Dinner',
    date: '2026-06-06',
    items: [
      { ingredient: { name: 'bread', measure: 'item' as MeasureId, amount: 2 }, allocations: [{ inventoryItemId: 'i1', amount: 2 }] },
      { ingredient: { name: 'butter', measure: 'g' as MeasureId, amount: 15 }, allocations: [] },
    ],
  },
  {
    plannedMealId: 'meal-2',
    plannedMealShortId: 'meal-2-short',
    houseId: 'h1',
    name: 'Leftover rice night',
    date: '2026-06-05',
    items: [],
  },
];

describe('Planner', () => {
  beforeEach(() => (fetch as jest.Mock).mockReset());

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
    // mockMeals fall in the week of Mon 1 Jun 2026 — pin "today" there so the
    // selected-week filter (see the filtering test below) doesn't drop them.
    jest.useFakeTimers().setSystemTime(new Date('2026-06-03T12:00:00Z'));
    useSWR.mockReturnValue({ isLoading: false, data: mockMeals, error: undefined });
    render(<Planner />);
    jest.useRealTimers();

    const names = screen.getAllByRole('heading', { level: 4 }).map((el) => el.textContent);
    expect(names).toEqual(['Leftover rice night', 'Dinner']);
  });

  it('flags ingredients with no inventory allocation as to buy', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-03T12:00:00Z'));
    useSWR.mockReturnValue({ isLoading: false, data: mockMeals, error: undefined });
    render(<Planner />);
    jest.useRealTimers();

    expect(screen.getByText(/butter/)).toHaveTextContent('(to buy)');
    expect(screen.getByText(/bread/)).not.toHaveTextContent('(to buy)');
  });

  it('recomputes the requested week from the current date on every render, not just once', () => {
    useSWR.mockReturnValue({ isLoading: false, data: [], error: undefined });

    jest.useFakeTimers().setSystemTime(new Date('2026-06-03T12:00:00Z'));
    render(<Planner />);
    const firstKey = useSWR.mock.calls[useSWR.mock.calls.length - 1][0];

    // A different month (not just a different week), so the fetched grid
    // range is guaranteed to differ too.
    jest.setSystemTime(new Date('2026-08-05T12:00:00Z'));
    render(<Planner />);
    const secondKey = useSWR.mock.calls[useSWR.mock.calls.length - 1][0];

    jest.useRealTimers();

    expect(secondKey).not.toEqual(firstKey);
  });

  it('fetches the whole visible month grid, not just the selected week, so the calendar can outline every planned day on screen', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-03T12:00:00Z'));
    useSWR.mockReturnValue({ isLoading: false, data: [], error: undefined });
    render(<Planner />);
    jest.useRealTimers();

    // June 2026's grid runs Mon 1 Jun (no leading days) to Sun 5 Jul (trailing
    // days needed to fill the last row) — a superset of the selected week.
    const key = useSWR.mock.calls[useSWR.mock.calls.length - 1][0];
    expect(key).toEqual(['/api/planned-meals', 'h1', '2026-06-01', '2026-07-05']);
  });

  it('refetches for the visible grid when navigating to a different month', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-03T12:00:00Z'));
    useSWR.mockReturnValue({ isLoading: false, data: [], error: undefined });
    render(<Planner />);
    jest.useRealTimers();

    fireEvent.click(screen.getByLabelText('Next month'));

    const updatedKey = useSWR.mock.calls[useSWR.mock.calls.length - 1][0];
    expect(updatedKey).toEqual(['/api/planned-meals', 'h1', '2026-06-29', '2026-08-02']);
  });

  it('only lists meals from the selected week even though a wider range was fetched', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-03T12:00:00Z'));
    useSWR.mockReturnValue({ isLoading: false, data: mockMeals, error: undefined });
    render(<Planner />);
    jest.useRealTimers();

    // mockMeals are 5/6 June, both inside the selected week (1-7 June).
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(2);
  });

  it('shows an edit link for house owners', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-03T12:00:00Z'));
    useSWR.mockReturnValue({ isLoading: false, data: mockMeals, error: undefined });
    render(<Planner />);
    jest.useRealTimers();

    expect(screen.getAllByRole('link', { name: 'Edit' })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Edit' })[0]).toHaveAttribute('href', '/planner/meal-2-short/edit');
  });

  it('shows a Mark eaten button only for meals with an allocated ingredient', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-03T12:00:00Z'));
    useSWR.mockReturnValue({ isLoading: false, data: mockMeals, error: undefined, mutate: jest.fn() });
    render(<Planner />);
    jest.useRealTimers();

    // Only "Dinner" (meal-1) has an allocated ingredient; "Leftover rice night" has none.
    expect(screen.getAllByRole('button', { name: 'Mark eaten' })).toHaveLength(1);
  });

  it('shows "Eaten" instead of the button once a meal has been marked eaten', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-03T12:00:00Z'));
    const eatenMeals = [{ ...mockMeals[0], eatenAt: '2026-06-06T18:00:00Z' }, mockMeals[1]];
    useSWR.mockReturnValue({ isLoading: false, data: eatenMeals, error: undefined, mutate: jest.fn() });
    render(<Planner />);
    jest.useRealTimers();

    expect(screen.getByText('Eaten')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark eaten' })).not.toBeInTheDocument();
  });

  it('marks a meal as eaten and refreshes the list on success', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-03T12:00:00Z'));
    const mutate = jest.fn();
    useSWR.mockReturnValue({ isLoading: false, data: mockMeals, error: undefined, mutate });
    (fetch as jest.Mock).mockResolvedValue({ ok: true });
    render(<Planner />);
    jest.useRealTimers();

    fireEvent.click(screen.getByRole('button', { name: 'Mark eaten' }));

    await screen.findByRole('button', { name: 'Mark eaten' });
    expect(fetch).toHaveBeenCalledWith('/api/planned-meals/meal-1/eaten', expect.objectContaining({ method: 'POST' }));
    expect(mutate).toHaveBeenCalled();
  });

  it('shows an error message when marking eaten fails', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-03T12:00:00Z'));
    useSWR.mockReturnValue({ isLoading: false, data: mockMeals, error: undefined, mutate: jest.fn() });
    (fetch as jest.Mock).mockResolvedValue({ ok: false });
    render(<Planner />);
    jest.useRealTimers();

    fireEvent.click(screen.getByRole('button', { name: 'Mark eaten' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to mark as eaten. Please try again.');
  });

  it('outlines planned days on the calendar, including ones outside the selected week', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-03T12:00:00Z'));
    useSWR.mockReturnValue({ isLoading: false, data: mockMeals, error: undefined });
    render(<Planner />);
    jest.useRealTimers();

    // All in the week-of-1-June row, so disambiguate by that aria-label
    // rather than by day number (which repeats for trailing/leading days).
    const weekOne = screen.getAllByLabelText('Select week of 2026-06-01');
    const dayByText = (text: string) => weekOne.find((btn) => btn.textContent === text)!;

    expect(dayByText('5').className).toEqual(expect.stringContaining('ring-highlight'));
    expect(dayByText('6').className).toEqual(expect.stringContaining('ring-highlight'));
    expect(dayByText('4').className).not.toEqual(expect.stringContaining('ring-highlight'));
  });
});
