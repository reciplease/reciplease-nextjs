import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditPlannedMeal from '@/pages/planner/[plannedMealId]/edit';
import { full } from '@/lib/recipe-id';

jest.mock('swr');
jest.mock('@/lib/houses', () => ({
  useActiveHouse: jest.fn(),
}));
jest.mock('next/router', () => ({ useRouter: jest.fn() }));
jest.mock('next/link', () => ({ children, href }: { children: React.ReactNode; href: string }) => (
  <a href={href}>{children}</a>
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

const useSWR = require('swr').default as jest.Mock;
const { useActiveHouse } = require('@/lib/houses');
const useRouter = require('next/router').useRouter as jest.Mock;

// The generated SWR hooks pass their key to `swr` as a thunk (or, for
// useMeasures, a plain string) — resolve it the same way the real `swr`
// package would before matching on it.
function resolveKey(key: unknown): unknown {
  return typeof key === 'function' ? (key as () => unknown)() : key;
}

function wrap<T>(data: T) {
  return { data, status: 200, headers: new Headers() };
}

const items: Measure = { measureId: 'item', singular: 'item', plural: 'items', short: 'item' };

const plannedMealShortId = 'EREREREREREREREREREREQ';
const plannedMealId = full(plannedMealShortId);

const meal: PlannedMeal = {
  plannedMealId,
  plannedMealShortId,
  houseId: 'house-1',
  name: 'Dinner',
  date: '2026-06-06',
  items: [
    { ingredient: { name: 'bread', measure: items.measureId ?? 'item', amount: 2 }, allocations: [{ pantryItemId: 'inv-1', amount: 2 }] },
  ],
  eatenAt: '2026-06-06T18:00:00Z',
};

function mockMealSWR(result: { isLoading: boolean; data: PlannedMeal | undefined; error: Error | undefined }) {
  useSWR.mockImplementation((key: unknown) => {
    const resolved = resolveKey(key);
    const url = Array.isArray(resolved) ? resolved[0] : resolved;
    if (url === '/api/recipes') return { data: wrap([]) };
    if (url === '/api/pantry') return { data: wrap([]) };
    if (url === '/api/measures') return { data: [items] };
    return { ...result, data: result.data ? wrap(result.data) : undefined };
  });
}

describe('EditPlannedMeal page', () => {
  const push = jest.fn();
  const back = jest.fn();

  beforeEach(() => {
    mockApiClientMutator.mockReset();
    push.mockReset();
    back.mockReset();
    useRouter.mockReturnValue({ push, back, isReady: true, query: { plannedMealId: plannedMealShortId } });
    useActiveHouse.mockReturnValue({ id: 'house-1', name: 'Bayview Gardens', role: 'OWNER' });
  });

  it('shows loading state', () => {
    mockMealSWR({ isLoading: true, data: undefined, error: undefined });
    render(<EditPlannedMeal />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows not found when error', () => {
    mockMealSWR({ isLoading: false, data: undefined, error: new Error('fail') });
    render(<EditPlannedMeal />);
    expect(screen.getByText('No planned meal found')).toBeInTheDocument();
  });

  it('shows a not-authorized message when the caller is not an OWNER of the meal house', () => {
    mockMealSWR({ isLoading: false, data: meal, error: undefined });
    useActiveHouse.mockReturnValue({ id: 'house-1', name: 'Bayview Gardens', role: 'READ_ONLY' });
    render(<EditPlannedMeal />);
    expect(screen.getByText('You do not have permission to edit this meal.')).toBeInTheDocument();
  });

  it('renders the form pre-filled with the meal details', () => {
    mockMealSWR({ isLoading: false, data: meal, error: undefined });
    render(<EditPlannedMeal />);

    expect(screen.getByLabelText('Meal name')).toHaveValue('Dinner');
    expect(screen.getByLabelText('Date')).toHaveValue('2026-06-06');
    expect(screen.getByLabelText('Ingredient name')).toHaveValue('bread');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  });

  it('saves changes and redirects to the planner on success', async () => {
    mockMealSWR({ isLoading: false, data: meal, error: undefined });
    mockApiClientMutator.mockResolvedValue({ data: meal, status: 200, headers: new Headers() });
    render(<EditPlannedMeal />);

    fireEvent.change(screen.getByLabelText('Meal name'), { target: { value: 'Supper' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(mockApiClientMutator).toHaveBeenCalledWith(
        `/api/planned-meals/${plannedMealId}`,
        expect.objectContaining({ method: 'PUT' }),
      );
      expect(push).toHaveBeenCalledWith('/planner');
    });
  });

  it('shows an error message when save fails', async () => {
    mockMealSWR({ isLoading: false, data: meal, error: undefined });
    mockApiClientMutator.mockResolvedValue({
      data: { timestamp: '2026-06-06T18:00:00Z', status: 500, error: 'Internal Server Error', path: `/api/planned-meals/${plannedMealId}` },
      status: 500,
      headers: new Headers(),
    });
    render(<EditPlannedMeal />);

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    });
    expect(push).not.toHaveBeenCalled();
  });

  describe('delete', () => {
    let confirmSpy: jest.SpyInstance;

    beforeEach(() => {
      confirmSpy = jest.spyOn(window, 'confirm');
    });

    afterEach(() => confirmSpy.mockRestore());

    it('does nothing when the confirm dialog is dismissed', () => {
      confirmSpy.mockReturnValue(false);
      mockMealSWR({ isLoading: false, data: meal, error: undefined });
      render(<EditPlannedMeal />);

      fireEvent.click(screen.getByRole('button', { name: 'Delete meal' }));

      expect(mockApiClientMutator).not.toHaveBeenCalledWith(
        `/api/planned-meals/${plannedMealId}`,
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('deletes the meal and redirects to the planner on confirm', async () => {
      confirmSpy.mockReturnValue(true);
      mockMealSWR({ isLoading: false, data: meal, error: undefined });
      mockApiClientMutator.mockResolvedValue({ data: undefined, status: 200, headers: new Headers() });
      render(<EditPlannedMeal />);

      fireEvent.click(screen.getByRole('button', { name: 'Delete meal' }));

      await waitFor(() => {
        expect(mockApiClientMutator).toHaveBeenCalledWith(
          `/api/planned-meals/${plannedMealId}`,
          expect.objectContaining({ method: 'DELETE' }),
        );
        expect(push).toHaveBeenCalledWith('/planner');
      });
    });

    it('shows an error message when deletion fails', async () => {
      confirmSpy.mockReturnValue(true);
      mockMealSWR({ isLoading: false, data: meal, error: undefined });
      mockApiClientMutator.mockResolvedValue({
        data: { timestamp: '2026-06-06T18:00:00Z', status: 500, error: 'Internal Server Error', path: `/api/planned-meals/${plannedMealId}` },
        status: 500,
        headers: new Headers(),
      });
      render(<EditPlannedMeal />);

      fireEvent.click(screen.getByRole('button', { name: 'Delete meal' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
      });
      expect(push).not.toHaveBeenCalled();
    });
  });
});
