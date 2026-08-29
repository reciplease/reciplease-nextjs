import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NewRecipe from '@/pages/recipes/new';
import { shorten } from '@/lib/recipe-id';

jest.mock('swr');
jest.mock('next/router', () => ({ useRouter: jest.fn() }));
jest.mock('@/components/Metadata', () => () => null);
jest.mock('@/lib/houses', () => ({}));

// The generated client (src/types/generated/client.ts) calls this mutator
// directly rather than `fetch` — mocking it here keeps the generated request
// building/response envelope handling exercised for real, while giving the
// tests a single, low-level seam to assert against. The recipe-import flow
// (`/api/import-recipe`) is a Next.js API route, not a generated backend
// endpoint, so it's untouched by this migration and still goes through
// `global.fetch` directly.
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
global.fetch = jest.fn();

const grams: Measure = { measureId: 'GRAMS', singular: 'gram', plural: 'grams', short: 'g' };
const items: Measure = { measureId: 'ITEMS', singular: 'item', plural: 'items', short: 'item' };

const RECIPE_ID = '111111111111111111111111';
const RECIPE_SHORT_ID = shorten(RECIPE_ID);

function findMutatorCall(url: string) {
  return mockApiClientMutator.mock.calls.find(([calledUrl]) => calledUrl === url);
}

describe('NewRecipe builder', () => {
  const push = jest.fn();

  beforeEach(() => {
    (fetch as jest.Mock).mockReset();
    mockApiClientMutator.mockReset();
    push.mockReset();
    useRouter.mockReturnValue({ push, back: jest.fn() });
    useSWR.mockReturnValue({ data: [grams, items] });
  });

  it('renders the core fields with a single trailing row for each list', () => {
    render(<NewRecipe />);
    expect(screen.getByLabelText('Recipe title')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByLabelText('Ingredient 1')).toBeInTheDocument();
    expect(screen.queryByLabelText('Ingredient 2')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Step 1')).toBeInTheDocument();
    expect(screen.queryByLabelText('Step 2')).not.toBeInTheDocument();
  });

  it('updates the description field as the user types', () => {
    render(<NewRecipe />);
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'A tasty dish' } });
    expect(screen.getByLabelText('Description')).toHaveValue('A tasty dish');
  });

  it('spawns a new empty ingredient row once one is named', () => {
    render(<NewRecipe />);
    fireEvent.change(screen.getByLabelText('Ingredient 1'), { target: { value: 'Onion' } });
    expect(screen.getByLabelText('Ingredient 1')).toHaveValue('Onion');
    expect(screen.getByLabelText('Ingredient 2')).toBeInTheDocument();
  });

  it('spawns a new empty step once the trailing one is typed into', () => {
    render(<NewRecipe />);
    fireEvent.change(screen.getByLabelText('Step 1'), { target: { value: 'Chop' } });
    expect(screen.getByLabelText('Step 2')).toBeInTheDocument();
    expect(screen.queryByLabelText('Step 3')).not.toBeInTheDocument();
  });

  it('does not spawn an extra row when typing only whitespace into the last ingredient', () => {
    render(<NewRecipe />);
    fireEvent.change(screen.getByLabelText('Ingredient 1'), { target: { value: '  ' } });
    expect(screen.queryByLabelText('Ingredient 2')).not.toBeInTheDocument();
  });

  it('does not spawn an extra row when re-naming a non-trailing ingredient', () => {
    render(<NewRecipe />);
    fireEvent.change(screen.getByLabelText('Ingredient 1'), { target: { value: 'Onion' } });
    fireEvent.change(screen.getByLabelText('Ingredient 1'), { target: { value: 'Garlic' } });
    expect(screen.getByLabelText('Ingredient 1')).toHaveValue('Garlic');
    expect(screen.getByLabelText('Ingredient 2')).toHaveValue('');
    expect(screen.queryByLabelText('Ingredient 3')).not.toBeInTheDocument();
  });

  it('does not spawn an extra step when re-typing a non-trailing step or clearing the trailing one', () => {
    render(<NewRecipe />);
    fireEvent.change(screen.getByLabelText('Step 1'), { target: { value: 'Chop' } });
    fireEvent.change(screen.getByLabelText('Step 1'), { target: { value: 'Dice' } });
    expect(screen.getByLabelText('Step 1')).toHaveValue('Dice');
    expect(screen.queryByLabelText('Step 3')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Step 2'), { target: { value: ' ' } });
    expect(screen.queryByLabelText('Step 3')).not.toBeInTheDocument();
  });

  it('saves: creates the recipe, attaches filled ingredients, then redirects', async () => {
    mockApiClientMutator.mockImplementation((url: string) =>
      url === '/api/recipes'
        ? Promise.resolve({ data: { recipeId: RECIPE_ID }, status: 200, headers: new Headers() })
        : Promise.resolve({ data: {}, status: 200, headers: new Headers() }),
    );

    render(<NewRecipe />);
    fireEvent.change(screen.getByLabelText('Recipe title'), { target: { value: 'Tacos' } });
    fireEvent.change(screen.getByLabelText('Ingredient 1'), { target: { value: 'Beef' } });
    fireEvent.change(screen.getByLabelText('Measure 1'), { target: { value: 'GRAMS' } });
    fireEvent.change(screen.getByLabelText('Amount 1'), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText('Step 1'), { target: { value: 'Brown the beef' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save recipe' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith(`/recipes/${RECIPE_SHORT_ID}`));

    expect(findMutatorCall('/api/recipes')![1]).toEqual(
      expect.objectContaining({ method: 'POST' }),
    );
    expect(JSON.parse(findMutatorCall('/api/recipes')![1].body)).toEqual({
      name: 'Tacos',
      description: '',
      steps: ['Brown the beef'],
      isPublic: false,
      sourceUrl: '',
      owned: 'false',
      ingredients: [],
    });

    expect(findMutatorCall(`/api/recipes/${RECIPE_ID}/ingredients`)![1]).toEqual(
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(JSON.parse(findMutatorCall(`/api/recipes/${RECIPE_ID}/ingredients`)![1].body)).toEqual({
      name: 'Beef',
      measure: 'GRAMS',
      amount: 500,
    });
  });

  it('defaults the ingredient measure to the first available measure when none is selected', async () => {
    mockApiClientMutator.mockImplementation((url: string) =>
      url === '/api/recipes'
        ? Promise.resolve({ data: { recipeId: RECIPE_ID }, status: 200, headers: new Headers() })
        : Promise.resolve({ data: {}, status: 200, headers: new Headers() }),
    );

    render(<NewRecipe />);
    fireEvent.change(screen.getByLabelText('Recipe title'), { target: { value: 'Tacos' } });
    fireEvent.change(screen.getByLabelText('Ingredient 1'), { target: { value: 'Beef' } });
    fireEvent.change(screen.getByLabelText('Amount 1'), { target: { value: '500' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save recipe' }));

    await waitFor(() => {
      expect(JSON.parse(findMutatorCall(`/api/recipes/${RECIPE_ID}/ingredients`)![1].body)).toEqual({
        name: 'Beef',
        measure: 'GRAMS',
        amount: 500,
      });
    });
  });

  it('defaults the ingredient measure to an empty string when no measures are available', async () => {
    useSWR.mockReturnValue({ data: undefined });
    mockApiClientMutator.mockImplementation((url: string) =>
      url === '/api/recipes'
        ? Promise.resolve({ data: { recipeId: RECIPE_ID }, status: 200, headers: new Headers() })
        : Promise.resolve({ data: {}, status: 200, headers: new Headers() }),
    );

    render(<NewRecipe />);
    fireEvent.change(screen.getByLabelText('Recipe title'), { target: { value: 'Tacos' } });
    fireEvent.change(screen.getByLabelText('Ingredient 1'), { target: { value: 'Beef' } });
    fireEvent.change(screen.getByLabelText('Amount 1'), { target: { value: '500' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save recipe' }));

    await waitFor(() => {
      expect(JSON.parse(findMutatorCall(`/api/recipes/${RECIPE_ID}/ingredients`)![1].body)).toEqual({
        name: 'Beef',
        measure: '',
        amount: 500,
      });
    });
  });

  it('blocks save when an ingredient is named without an amount', async () => {
    render(<NewRecipe />);
    fireEvent.change(screen.getByLabelText('Recipe title'), { target: { value: 'Tacos' } });
    fireEvent.change(screen.getByLabelText('Ingredient 1'), { target: { value: 'Beef' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save recipe' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/amount greater than 0/);
    });
    expect(mockApiClientMutator).not.toHaveBeenCalledWith('/api/recipes', expect.anything());
  });

  it('surfaces an error when recipe creation fails', async () => {
    mockApiClientMutator.mockResolvedValue({
      data: { timestamp: '2026-06-06T18:00:00Z', status: 500, error: 'Internal Server Error', path: '/api/recipes' },
      status: 500,
      headers: new Headers(),
    });
    render(<NewRecipe />);
    fireEvent.change(screen.getByLabelText('Recipe title'), { target: { value: 'Tacos' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save recipe' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    });
  });

  it('surfaces an error when an ingredient cannot be attached', async () => {
    mockApiClientMutator.mockImplementation((url: string) =>
      url === '/api/recipes'
        ? Promise.resolve({ data: { recipeId: RECIPE_ID }, status: 200, headers: new Headers() })
        : Promise.resolve({
            data: { timestamp: '2026-06-06T18:00:00Z', status: 500, error: 'Internal Server Error', path: `/api/recipes/${RECIPE_ID}/ingredients` },
            status: 500,
            headers: new Headers(),
          }),
    );

    render(<NewRecipe />);
    fireEvent.change(screen.getByLabelText('Recipe title'), { target: { value: 'Tacos' } });
    fireEvent.change(screen.getByLabelText('Ingredient 1'), { target: { value: 'Beef' } });
    fireEvent.change(screen.getByLabelText('Measure 1'), { target: { value: 'GRAMS' } });
    fireEvent.change(screen.getByLabelText('Amount 1'), { target: { value: '500' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save recipe' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/some ingredients could not be added/);
    });
    expect(push).not.toHaveBeenCalled();
  });
});
