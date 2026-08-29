import { render, screen, fireEvent, within } from '@testing-library/react';
import Planner from '@/pages/planner/index';
import { shorten } from '@/lib/recipe-id';

jest.mock('swr');
jest.mock('@/lib/houses', () => ({
  useActiveHouse: () => ({ id: 'h1', name: 'Home', role: 'OWNER' }),
}));
jest.mock('next/link', () => ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
  <a href={href} className={className}>{children}</a>
));
jest.mock('@/components/Metadata', () => () => null);

// The generated client (src/types/generated/client.ts) calls this mutator
// directly rather than `fetch` — mocking it here keeps the generated request
// building/response envelope handling exercised for real, while giving the
// tests a single, low-level seam to assert against.
const mockApiClientMutator = jest.fn();
jest.mock('@/lib/apiClientMutator', () => ({
  apiClientMutator: (...args: unknown[]) => mockApiClientMutator(...args),
  isSuccessResponse: (response: { status: number }) => response.status >= 200 && response.status < 300,
  describeErrorStatus: (status: number) => {
    if (status === 401) return 'Please sign in again.';
    if (status === 403) return "You don't have permission to do that.";
    if (status === 404) return "That couldn't be found.";
    if (status >= 400 && status < 500) return 'Please check your input and try again.';
    return 'Something went wrong. Please try again.';
  },
}));

const useSWR = require('swr').default;

// The generated useFindPlannedMealsByDateRange hook passes its key to `swr`
// as a thunk (`() => isEnabled ? [...] : null`), not a plain key — resolve it
// the same way the real `swr` package would before matching/asserting on it.
function resolveKey(key: unknown): unknown {
  return typeof key === 'function' ? (key as () => unknown)() : key;
}

function wrap<T>(data: T) {
  return { data, status: 200, headers: new Headers() };
}

const MEAL_1_ID = '111111111111111111111111';
const MEAL_2_ID = '222222222222222222222222';
const MEAL_1_SHORT_ID = shorten(MEAL_1_ID);
const MEAL_2_SHORT_ID = shorten(MEAL_2_ID);

const mockMeals: PlannedMeal[] = [
  {
    plannedMealId: MEAL_1_ID,
    plannedMealShortId: MEAL_1_SHORT_ID,
    houseId: 'h1',
    name: 'Dinner',
    date: '2026-06-06',
    items: [
      { ingredient: { name: 'bread', measure: 'item' as MeasureId, amount: 2 }, allocations: [{ pantryItemId: 'i1', amount: 2 }] },
      { ingredient: { name: 'butter', measure: 'g' as MeasureId, amount: 15 }, allocations: [] },
    ],
    eatenAt: '',
  },
  {
    plannedMealId: MEAL_2_ID,
    plannedMealShortId: MEAL_2_SHORT_ID,
    houseId: 'h1',
    name: 'Leftover rice night',
    date: '2026-06-05',
    items: [],
    eatenAt: '',
  },
];

describe('Planner', () => {
  beforeEach(() => mockApiClientMutator.mockReset());

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
    useSWR.mockReturnValue({ isLoading: false, data: wrap([]), error: undefined });
    render(<Planner />);
    expect(screen.getByText('No meals planned this week')).toBeInTheDocument();
  });

  it('renders planned meals sorted by date', () => {
    // mockMeals fall in the week of Mon 1 Jun 2026 — pin "today" there so the
    // selected-week filter (see the filtering test below) doesn't drop them.
    jest.useFakeTimers().setSystemTime(new Date('2026-06-03T12:00:00Z'));
    useSWR.mockReturnValue({ isLoading: false, data: wrap(mockMeals), error: undefined });
    render(<Planner />);
    jest.useRealTimers();

    const names = screen.getAllByRole('heading', { level: 4 }).map((el) => el.textContent);
    expect(names).toEqual(['Leftover rice night', 'Dinner']);
  });

  it('flags ingredients with no pantry allocation as to buy', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-03T12:00:00Z'));
    useSWR.mockReturnValue({ isLoading: false, data: wrap(mockMeals), error: undefined });
    render(<Planner />);
    jest.useRealTimers();

    expect(screen.getByText(/butter/)).toHaveTextContent('(to buy)');
    expect(screen.getByText(/bread/)).not.toHaveTextContent('(to buy)');
  });

  it('recomputes the requested week from the current date on every render, not just once', () => {
    useSWR.mockReturnValue({ isLoading: false, data: wrap([]), error: undefined });

    jest.useFakeTimers().setSystemTime(new Date('2026-06-03T12:00:00Z'));
    render(<Planner />);
    const firstKey = resolveKey(useSWR.mock.calls[useSWR.mock.calls.length - 1][0]);

    // A different month (not just a different week), so the fetched grid
    // range is guaranteed to differ too.
    jest.setSystemTime(new Date('2026-08-05T12:00:00Z'));
    render(<Planner />);
    const secondKey = resolveKey(useSWR.mock.calls[useSWR.mock.calls.length - 1][0]);

    jest.useRealTimers();

    expect(secondKey).not.toEqual(firstKey);
  });

  it('fetches the whole visible month grid, not just the selected week, so the calendar can outline every planned day on screen', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-03T12:00:00Z'));
    useSWR.mockReturnValue({ isLoading: false, data: wrap([]), error: undefined });
    render(<Planner />);
    jest.useRealTimers();

    // June 2026's grid runs Mon 1 Jun (no leading days) to Sun 5 Jul (trailing
    // days needed to fill the last row) — a superset of the selected week.
    // Note: the generated hook's cache key doesn't carry the active house id
    // (unlike the previous hand-written key) — see PlannedMealForm/planner
    // migration notes.
    const key = resolveKey(useSWR.mock.calls[useSWR.mock.calls.length - 1][0]);
    expect(key).toEqual(['/api/planned-meals', { start: '2026-06-01', end: '2026-07-05' }]);
  });

  it('refetches for the visible grid when navigating to a different month', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-03T12:00:00Z'));
    useSWR.mockReturnValue({ isLoading: false, data: wrap([]), error: undefined });
    render(<Planner />);
    jest.useRealTimers();

    fireEvent.click(screen.getByLabelText('Next month'));

    const updatedKey = resolveKey(useSWR.mock.calls[useSWR.mock.calls.length - 1][0]);
    expect(updatedKey).toEqual(['/api/planned-meals', { start: '2026-06-29', end: '2026-08-02' }]);
  });

  it('only lists meals from the selected week even though a wider range was fetched', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-03T12:00:00Z'));
    useSWR.mockReturnValue({ isLoading: false, data: wrap(mockMeals), error: undefined });
    render(<Planner />);
    jest.useRealTimers();

    // mockMeals are 5/6 June, both inside the selected week (1-7 June).
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(2);
  });

  it('shows an edit link for house owners', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-03T12:00:00Z'));
    useSWR.mockReturnValue({ isLoading: false, data: wrap(mockMeals), error: undefined });
    render(<Planner />);
    jest.useRealTimers();

    expect(screen.getAllByRole('link', { name: 'Edit' })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Edit' })[0]).toHaveAttribute('href', `/planner/${MEAL_2_SHORT_ID}/edit`);
  });

  it('shows a Mark eaten button only for meals with an allocated ingredient', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-03T12:00:00Z'));
    useSWR.mockReturnValue({ isLoading: false, data: wrap(mockMeals), error: undefined, mutate: jest.fn() });
    render(<Planner />);
    jest.useRealTimers();

    // Only "Dinner" (meal-1) has an allocated ingredient; "Leftover rice night" has none.
    expect(screen.getAllByRole('button', { name: 'Mark eaten' })).toHaveLength(1);
  });

  it('shows "Eaten" instead of the button once a meal has been marked eaten', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-03T12:00:00Z'));
    const eatenMeals = [{ ...mockMeals[0], eatenAt: '2026-06-06T18:00:00Z' }, mockMeals[1]];
    useSWR.mockReturnValue({ isLoading: false, data: wrap(eatenMeals), error: undefined, mutate: jest.fn() });
    render(<Planner />);
    jest.useRealTimers();

    expect(screen.getByText('Eaten')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark eaten' })).not.toBeInTheDocument();
  });

  it('marks a meal as eaten and refreshes the list on success', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-03T12:00:00Z'));
    const mutate = jest.fn();
    useSWR.mockReturnValue({ isLoading: false, data: wrap(mockMeals), error: undefined, mutate });
    mockApiClientMutator.mockResolvedValue({ data: mockMeals[0], status: 200, headers: new Headers() });
    render(<Planner />);
    jest.useRealTimers();

    fireEvent.click(screen.getByRole('button', { name: 'Mark eaten' }));

    await screen.findByRole('button', { name: 'Mark eaten' });
    expect(mockApiClientMutator).toHaveBeenCalledWith(
      `/api/planned-meals/${MEAL_1_ID}/eaten`,
      expect.objectContaining({ method: 'POST' }),
    );
    expect(mutate).toHaveBeenCalled();
  });

  it('shows an error message when marking eaten fails', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-03T12:00:00Z'));
    useSWR.mockReturnValue({ isLoading: false, data: wrap(mockMeals), error: undefined, mutate: jest.fn() });
    mockApiClientMutator.mockResolvedValue({
      data: { timestamp: '2026-06-06T18:00:00Z', status: 500, error: 'Internal Server Error', path: `/api/planned-meals/${MEAL_1_ID}/eaten` },
      status: 500,
      headers: new Headers(),
    });
    render(<Planner />);
    jest.useRealTimers();

    fireEvent.click(screen.getByRole('button', { name: 'Mark eaten' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
  });

  it('marks planned days on the calendar with a dot, including ones outside the selected week', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-03T12:00:00Z'));
    useSWR.mockReturnValue({ isLoading: false, data: wrap(mockMeals), error: undefined });
    render(<Planner />);
    jest.useRealTimers();

    // All in the week-of-1-June row, so disambiguate by that aria-label
    // rather than by day number (which repeats for trailing/leading days).
    const weekOne = screen.getAllByLabelText('Select week of 2026-06-01');
    const dayByText = (text: string) => weekOne.find((btn) => btn.textContent === text)!;

    expect(within(dayByText('5')).queryByTestId('planned-meal-dot')).toBeInTheDocument();
    expect(within(dayByText('6')).queryByTestId('planned-meal-dot')).toBeInTheDocument();
    expect(within(dayByText('4')).queryByTestId('planned-meal-dot')).not.toBeInTheDocument();
  });

  it('tints the selected week with the accent colour and every other week with a muted neutral', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-03T12:00:00Z'));
    useSWR.mockReturnValue({ isLoading: false, data: wrap(mockMeals), error: undefined });
    render(<Planner />);
    jest.useRealTimers();

    // 3 June 2026 falls in the week of Monday 1 June, so that's the
    // initially-selected week; the week of 8 June is a different, muted one.
    const selectedWeekDay = screen.getAllByLabelText('Select week of 2026-06-01')[0];
    const otherWeekDay = screen.getAllByLabelText('Select week of 2026-06-08')[0];

    expect(selectedWeekDay.parentElement?.className).toEqual(expect.stringContaining('bg-highlight/20'));
    expect(otherWeekDay.parentElement?.className).toEqual(expect.stringContaining('bg-white/5'));
    expect(otherWeekDay.parentElement?.className).not.toEqual(expect.stringContaining('bg-highlight/20'));
  });
});
