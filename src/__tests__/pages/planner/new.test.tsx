import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NewPlannedMeal from '@/pages/planner/new';

jest.mock('swr');
jest.mock('next/router', () => ({ useRouter: jest.fn() }));
jest.mock('@/components/Metadata', () => () => null);
jest.mock('@/lib/houses', () => ({
  useActiveHouse: () => ({ id: 'h1', name: 'Home', role: 'OWNER' }),
}));

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
const useRouter = require('next/router').useRouter as jest.Mock;

// The generated SWR hooks (useFindAllRecipes/useFindAllPantryItems/
// useMeasures) pass their key to `swr` as a thunk, not a plain key — resolve
// it the same way the real `swr` package would before matching on it.
function resolveKey(key: unknown): unknown {
  return typeof key === 'function' ? (key as () => unknown)() : key;
}

function wrap<T>(data: T) {
  return { data, status: 200, headers: new Headers() };
}

const grams: Measure = { measureId: 'g', singular: 'gram', plural: 'grams', short: 'g' };
const items: Measure = { measureId: 'item', singular: 'item', plural: 'items', short: 'item' };

const mockRecipe: Recipe = {
  recipeId: 'recipe-1',
  recipeShortId: 'r1',
  owned: 'true',
  createdBy: undefined,
  updatedBy: undefined,
  isPublic: false,
  name: 'Toast',
  description: '',
  sourceUrl: '',
  ingredients: [{ name: 'bread', measure: items.measureId ?? 'item', amount: 2 }],
  steps: [],
  updatedAt: '2026-06-06T18:00:00Z',
  upvoteCount: 0,
  upvotedByCurrentUser: false,
};

const mockPantryItem: PantryItem = {
  uuid: 'inv-1',
  name: 'Bread',
  measure: items.measureId ?? 'item',
  amount: 4,
  remaining: 4,
  expiration: '2099-12-31',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('NewPlannedMeal', () => {
  const push = jest.fn();

  beforeEach(() => {
    mockApiClientMutator.mockReset();
    push.mockReset();
    useRouter.mockReturnValue({ push, back: jest.fn() });
    useSWR.mockImplementation((key: unknown) => {
      const k = resolveKey(key);
      const url = Array.isArray(k) ? k[0] : k;
      if (url === '/api/recipes') return { data: wrap([mockRecipe]) };
      if (url === '/api/pantry') return { data: wrap([mockPantryItem]) };
      if (url === '/api/measures') return { data: [grams, items] };
      return { data: undefined };
    });
  });

  it('renders the core fields', () => {
    render(<NewPlannedMeal />);
    expect(screen.getByLabelText('Meal name')).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toBeInTheDocument();
    expect(screen.getByLabelText('Recipe')).toBeInTheDocument();
  });

  it('disables submit until a name is entered', () => {
    render(<NewPlannedMeal />);
    expect(screen.getByRole('button', { name: 'Plan meal' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Meal name'), { target: { value: 'Dinner' } });
    expect(screen.getByRole('button', { name: 'Plan meal' })).not.toBeDisabled();
  });

  it('adds an ingredient to buy via the freeform row', () => {
    render(<NewPlannedMeal />);
    fireEvent.change(screen.getByLabelText('New ingredient name'), { target: { value: 'Milk' } });
    fireEvent.change(screen.getByLabelText('New ingredient amount'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByLabelText('Ingredient name')).toHaveValue('Milk');
  });

  it('loads ingredients from the selected recipe', () => {
    render(<NewPlannedMeal />);
    fireEvent.change(screen.getByLabelText('Recipe'), { target: { value: 'recipe-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Load ingredients' }));

    expect(screen.getByLabelText('Ingredient name')).toHaveValue('bread');
  });

  it('submits the plan request and redirects to the planner', async () => {
    mockApiClientMutator.mockResolvedValue({ data: {}, status: 200, headers: new Headers() });

    render(<NewPlannedMeal />);
    fireEvent.change(screen.getByLabelText('Meal name'), { target: { value: 'Dinner' } });
    fireEvent.click(screen.getByRole('button', { name: 'Plan meal' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/planner'));

    expect(mockApiClientMutator).toHaveBeenCalledWith('/api/planned-meals', expect.objectContaining({ method: 'POST' }));
  });

  it('shows an error message when the request fails', async () => {
    // The mutator no longer rejects on an HTTP-level error — it resolves the
    // full envelope, with the backend's ErrorResponse as `.data`.
    mockApiClientMutator.mockResolvedValue({
      data: { timestamp: '2026-06-06T18:00:00Z', status: 400, error: "A meal named 'Dinner' is already planned for this date", path: '/api/planned-meals' },
      status: 400,
      headers: new Headers(),
    });

    render(<NewPlannedMeal />);
    fireEvent.change(screen.getByLabelText('Meal name'), { target: { value: 'Dinner' } });
    fireEvent.click(screen.getByRole('button', { name: 'Plan meal' }));

    // The current message is still generic, not the specific backend
    // message — see the comment in src/pages/planner/new.tsx.
    expect(await screen.findByRole('alert')).toHaveTextContent('Please check your input and try again.');
  });
});
