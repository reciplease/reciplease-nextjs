import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditRecipe, { getServerSideProps } from '@/pages/recipes/[recipeId]/edit';
import { full } from '@/lib/recipe-id';
import { GetServerSidePropsContext } from 'next';

jest.mock('swr');
jest.mock('@/lib/houses');
jest.mock('next/router', () => ({ useRouter: jest.fn() }));
jest.mock('next/link', () => ({ children, href }: { children: React.ReactNode; href: string }) => (
  <a href={href}>{children}</a>
));
jest.mock('@/components/Metadata', () => () => null);

const useSWR = require('swr').default as jest.Mock;
const { useActiveHouse } = require('@/lib/houses');
const useRouter = require('next/router').useRouter as jest.Mock;
global.fetch = jest.fn();

const grams: Measure = { measureId: 'GRAMS', singular: 'gram', plural: 'grams', short: 'g' };
const items: Measure = { measureId: 'ITEMS', singular: 'item', plural: 'items', short: 'item' };

const recipeShortId = 'EREREREREREREREREREREQ';
const recipeId = full(recipeShortId);

const recipe: Recipe = {
  recipeId,
  recipeShortId,
  houseId: 'house-1',
  isPublic: false,
  name: 'Tacos',
  description: 'Tasty tacos',
  ingredients: [
    { name: 'Beef', measure: grams, amount: 500 },
    { name: 'Tortilla', measure: items, amount: 1 },
  ],
  steps: ['Brown the beef', 'Warm the tortillas'],
};

function mockRecipeSWR(result: { isLoading: boolean; data: Recipe | undefined; error: Error | undefined }) {
  useSWR.mockImplementation((url: string) => {
    if (url === '/api/measures') return { data: [grams, items] };
    return result;
  });
}

describe('EditRecipe page', () => {
  const push = jest.fn();
  const back = jest.fn();

  beforeEach(() => {
    (fetch as jest.Mock).mockReset();
    push.mockReset();
    back.mockReset();
    useRouter.mockReturnValue({ push, back });
    useActiveHouse.mockReturnValue({ id: 'house-1', name: 'Bayview Gardens', role: 'OWNER' });
  });

  it('shows loading state', () => {
    mockRecipeSWR({ isLoading: true, data: undefined, error: undefined });
    render(<EditRecipe recipeShortId={recipeShortId} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows not found when error', () => {
    mockRecipeSWR({ isLoading: false, data: undefined, error: new Error('fail') });
    render(<EditRecipe recipeShortId={recipeShortId} />);
    expect(screen.getByText('No recipe found')).toBeInTheDocument();
  });

  it('shows not found when there is no recipe and no error', () => {
    mockRecipeSWR({ isLoading: false, data: undefined, error: undefined });
    render(<EditRecipe recipeShortId={recipeShortId} />);
    expect(screen.getByText('No recipe found')).toBeInTheDocument();
  });

  it('shows a not-authorized message and link back when the caller is not an OWNER of the recipe house', () => {
    mockRecipeSWR({ isLoading: false, data: recipe, error: undefined });
    useActiveHouse.mockReturnValue({ id: 'house-1', name: 'Bayview Gardens', role: 'READ_ONLY' });
    render(<EditRecipe recipeShortId={recipeShortId} />);
    expect(screen.getByText('You do not have permission to edit this recipe.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to recipe' })).toHaveAttribute(
      'href',
      `/recipes/${recipeShortId}`,
    );
  });

  it('renders the form pre-filled with the recipe details', () => {
    mockRecipeSWR({ isLoading: false, data: recipe, error: undefined });
    render(<EditRecipe recipeShortId={recipeShortId} />);

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
    render(<EditRecipe recipeShortId={recipeShortId} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove ingredient 1' }));

    expect(screen.getByLabelText('Ingredient 1')).toHaveValue('Tortilla');
    expect(screen.queryByLabelText('Ingredient 3')).not.toBeInTheDocument();
  });

  it('allows removing a step', () => {
    mockRecipeSWR({ isLoading: false, data: recipe, error: undefined });
    render(<EditRecipe recipeShortId={recipeShortId} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove step 1' }));

    expect(screen.getByLabelText('Step 1')).toHaveValue('Warm the tortillas');
    expect(screen.queryByLabelText('Step 3')).not.toBeInTheDocument();
  });

  it('navigates back when cancel is clicked', () => {
    mockRecipeSWR({ isLoading: false, data: recipe, error: undefined });
    render(<EditRecipe recipeShortId={recipeShortId} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(back).toHaveBeenCalled();
  });

  it('saves changes and redirects to the recipe page on success', async () => {
    mockRecipeSWR({ isLoading: false, data: recipe, error: undefined });
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
    render(<EditRecipe recipeShortId={recipeShortId} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        `/api/recipes/${recipeId}`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            name: 'Tacos',
            description: 'Tasty tacos',
            steps: ['Brown the beef', 'Warm the tortillas'],
            isPublic: false,
            ingredients: [
              { name: 'Beef', measure: 'GRAMS', amount: 500 },
              { name: 'Tortilla', measure: 'ITEMS', amount: 1 },
            ],
          }),
        }),
      );
      expect(push).toHaveBeenCalledWith(`/recipes/${recipeShortId}`);
    });
  });

  it('shows an error message when save fails', async () => {
    mockRecipeSWR({ isLoading: false, data: recipe, error: undefined });
    (fetch as jest.Mock).mockResolvedValue({ ok: false });
    render(<EditRecipe recipeShortId={recipeShortId} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to save changes. Please try again.');
    });
    expect(push).not.toHaveBeenCalled();
  });

  it('shows an unexpected error message if saving throws', async () => {
    mockRecipeSWR({ isLoading: false, data: recipe, error: undefined });
    (fetch as jest.Mock).mockRejectedValue(new Error('network down'));
    render(<EditRecipe recipeShortId={recipeShortId} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('An unexpected error occurred.');
    });
  });
});

describe('getServerSideProps', () => {
  it('passes the recipeId route param through as a prop', () => {
    const context = { params: { recipeId: 'abc-123' } } as unknown as GetServerSidePropsContext;

    expect(getServerSideProps(context)).toEqual({ props: { recipeShortId: 'abc-123' } });
  });
});
