import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditRecipe from '@/pages/recipes/[recipeId]/edit';
import { full } from '@/lib/recipe-id';

jest.mock('swr');
jest.mock('next/router', () => ({ useRouter: jest.fn() }));
jest.mock('next/link', () => ({ children, href }: { children: React.ReactNode; href: string }) => (
  <a href={href}>{children}</a>
));
jest.mock('@/components/Metadata', () => () => null);

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

function resolveKey(key: unknown): unknown {
  return typeof key === 'function' ? (key as () => unknown)() : key;
}

function wrap<T>(data: T) {
  return { data, status: 200, headers: new Headers() };
}

const grams: Measure = { measureId: 'GRAMS', singular: 'gram', plural: 'grams', short: 'g' };
const items: Measure = { measureId: 'ITEMS', singular: 'item', plural: 'items', short: 'item' };

const recipeShortId = 'EREREREREREREREREREREQ';
const recipeId = full(recipeShortId);

const recipe: Recipe = {
  recipeId,
  recipeShortId,
  owned: 'true',
  createdBy: undefined,
  updatedBy: undefined,
  isPublic: false,
  name: 'Tacos',
  description: 'Tasty tacos',
  sourceUrl: null as unknown as string,
  ingredients: [
    { name: 'Beef', measure: grams.measureId ?? 'GRAMS', amount: 500 },
    { name: 'Tortilla', measure: items.measureId ?? 'ITEMS', amount: 1 },
  ],
  steps: ['Brown the beef', 'Warm the tortillas'],
  updatedAt: '2026-06-06T18:00:00Z',
  upvoteCount: 0,
  upvotedByCurrentUser: false,
};

function mockRecipeSWR(result: { isLoading: boolean; data: Recipe | undefined; error: Error | undefined }) {
  useSWR.mockImplementation((key: unknown) => {
    const url = resolveKey(key);
    if (url === '/api/measures') return { data: [grams, items] };
    return { ...result, data: result.data ? wrap(result.data) : undefined };
  });
}

describe('EditRecipe page', () => {
  const push = jest.fn();
  const back = jest.fn();

  beforeEach(() => {
    mockApiClientMutator.mockReset();
    push.mockReset();
    back.mockReset();
    useRouter.mockReturnValue({ push, back, isReady: true, query: { recipeId: recipeShortId } });
  });

  it('shows loading state', () => {
    mockRecipeSWR({ isLoading: true, data: undefined, error: undefined });
    render(<EditRecipe />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows not found when error', () => {
    mockRecipeSWR({ isLoading: false, data: undefined, error: new Error('fail') });
    render(<EditRecipe />);
    expect(screen.getByText('No recipe found')).toBeInTheDocument();
  });

  it('shows not found when there is no recipe and no error', () => {
    mockRecipeSWR({ isLoading: false, data: undefined, error: undefined });
    render(<EditRecipe />);
    expect(screen.getByText('No recipe found')).toBeInTheDocument();
  });

  it('shows not-authorized when the recipe is not owned', () => {
    mockRecipeSWR({ isLoading: false, data: { ...recipe, owned: 'false' as const }, error: undefined });
    render(<EditRecipe />);
    expect(screen.getByText('You do not have permission to edit this recipe.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to recipe' })).toHaveAttribute(
      'href',
      `/recipes/${recipeShortId}`,
    );
  });

  it('renders the form pre-filled with the recipe details', () => {
    mockRecipeSWR({ isLoading: false, data: recipe, error: undefined });
    render(<EditRecipe />);

    expect(screen.getByLabelText('Recipe title')).toHaveValue('Tacos');
    expect(screen.getByLabelText('Description')).toHaveValue('Tasty tacos');

    expect(screen.getByLabelText('Ingredient 1')).toHaveValue('Beef');
    expect(screen.getByLabelText('Measure 1')).toHaveValue('GRAMS');
    expect(screen.getByLabelText('Amount 1')).toHaveValue(500);
    expect(screen.getByLabelText('Ingredient 2')).toHaveValue('Tortilla');
    expect(screen.getByLabelText('Measure 2')).toHaveValue('ITEMS');
    expect(screen.getByLabelText('Amount 2')).toHaveValue(1);
    expect(screen.getByLabelText('Ingredient 3')).toHaveValue('');

    expect(screen.getByLabelText('Step 1')).toHaveValue('Brown the beef');
    expect(screen.getByLabelText('Step 2')).toHaveValue('Warm the tortillas');
    expect(screen.getByLabelText('Step 3')).toHaveValue('');

    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  });

  it('allows removing an ingredient row', () => {
    mockRecipeSWR({ isLoading: false, data: recipe, error: undefined });
    render(<EditRecipe />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove ingredient 1' }));

    expect(screen.getByLabelText('Ingredient 1')).toHaveValue('Tortilla');
    expect(screen.queryByLabelText('Ingredient 3')).not.toBeInTheDocument();
  });

  it('allows removing a step', () => {
    mockRecipeSWR({ isLoading: false, data: recipe, error: undefined });
    render(<EditRecipe />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove step 1' }));

    expect(screen.getByLabelText('Step 1')).toHaveValue('Warm the tortillas');
    expect(screen.queryByLabelText('Step 3')).not.toBeInTheDocument();
  });

  it('navigates back when cancel is clicked', () => {
    mockRecipeSWR({ isLoading: false, data: recipe, error: undefined });
    render(<EditRecipe />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(back).toHaveBeenCalled();
  });

  it('saves changes and redirects to the recipe page on success', async () => {
    mockRecipeSWR({ isLoading: false, data: recipe, error: undefined });
    mockApiClientMutator.mockResolvedValue({ data: recipe, status: 200, headers: new Headers() });
    render(<EditRecipe />);

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(mockApiClientMutator).toHaveBeenCalledWith(
        `/api/recipes/${recipeId}`,
        expect.objectContaining({ method: 'PUT' }),
      );
      expect(push).toHaveBeenCalledWith(`/recipes/${recipeShortId}`);
    });

    const [, options] = mockApiClientMutator.mock.calls.find(([url]) => url === `/api/recipes/${recipeId}`)!;
    expect(JSON.parse(options.body)).toEqual({
      name: 'Tacos',
      description: 'Tasty tacos',
      steps: ['Brown the beef', 'Warm the tortillas'],
      isPublic: false,
      sourceUrl: '',
      owned: 'false',
      ingredients: [
        { name: 'Beef', measure: 'GRAMS', amount: 500 },
        { name: 'Tortilla', measure: 'ITEMS', amount: 1 },
      ],
    });
  });

  it('shows an error message when save fails', async () => {
    mockRecipeSWR({ isLoading: false, data: recipe, error: undefined });
    mockApiClientMutator.mockResolvedValue({
      data: { timestamp: '2026-06-06T18:00:00Z', status: 500, error: 'Internal Server Error', path: `/api/recipes/${recipeId}` },
      status: 500,
      headers: new Headers(),
    });
    render(<EditRecipe />);

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    });
    expect(push).not.toHaveBeenCalled();
  });
});
