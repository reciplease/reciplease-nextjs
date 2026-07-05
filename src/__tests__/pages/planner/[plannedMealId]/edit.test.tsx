import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditPlannedMeal from '@/pages/planner/[plannedMealId]/edit';
import { full } from '@/lib/recipe-id';

jest.mock('swr');
jest.mock('@/lib/houses', () => ({
  useActiveHouse: jest.fn(),
  apiFetch: (url: string, init?: RequestInit) => fetch(url, init),
}));
jest.mock('next/router', () => ({ useRouter: jest.fn() }));
jest.mock('next/link', () => ({ children, href }: { children: React.ReactNode; href: string }) => (
  <a href={href}>{children}</a>
));
jest.mock('@/components/Metadata', () => () => null);

const useSWR = require('swr').default as jest.Mock;
const { useActiveHouse } = require('@/lib/houses');
const useRouter = require('next/router').useRouter as jest.Mock;
global.fetch = jest.fn();

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
    { ingredient: { name: 'bread', measure: items.measureId, amount: 2 }, allocations: [{ inventoryItemId: 'inv-1', amount: 2 }] },
  ],
};

function mockMealSWR(result: { isLoading: boolean; data: PlannedMeal | undefined; error: Error | undefined }) {
  useSWR.mockImplementation((key: unknown) => {
    const url = Array.isArray(key) ? key[0] : key;
    if (url === '/api/recipes') return { data: [] };
    if (url === '/api/inventory') return { data: [] };
    if (url === '/api/measures') return { data: [items] };
    return result;
  });
}

describe('EditPlannedMeal page', () => {
  const push = jest.fn();
  const back = jest.fn();

  beforeEach(() => {
    (fetch as jest.Mock).mockReset();
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
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
    render(<EditPlannedMeal />);

    fireEvent.change(screen.getByLabelText('Meal name'), { target: { value: 'Supper' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        `/api/planned-meals/${plannedMealId}`,
        expect.objectContaining({ method: 'PUT' }),
      );
      expect(push).toHaveBeenCalledWith('/planner');
    });
  });

  it('shows an error message when save fails', async () => {
    mockMealSWR({ isLoading: false, data: meal, error: undefined });
    (fetch as jest.Mock).mockResolvedValue({ ok: false });
    render(<EditPlannedMeal />);

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to save changes. Please try again.');
    });
    expect(push).not.toHaveBeenCalled();
  });
});
