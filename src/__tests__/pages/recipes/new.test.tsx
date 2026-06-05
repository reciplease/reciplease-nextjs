import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NewRecipe from '@/pages/recipes/new';

jest.mock('swr');
jest.mock('next/router', () => ({ useRouter: jest.fn() }));
jest.mock('@/components/Metadata', () => () => null);

const useSWR = require('swr').default as jest.Mock;
const useRouter = require('next/router').useRouter as jest.Mock;
global.fetch = jest.fn();

const grams: Measure = { measureId: 'GRAMS', singular: 'gram', plural: 'grams' };
const items: Measure = { measureId: 'ITEMS', singular: 'item', plural: 'items' };

const searchResults: Ingredient[] = [
  { uuid: 'ing-onion', name: 'Onion', measure: items },
  { uuid: 'ing-beef', name: 'Beef', measure: grams },
];

// Route SWR responses by key so the search + measures hooks each get their data.
function swrByKey(data: { search?: Ingredient[]; measures?: Measure[] }) {
  return (key: string | null) => {
    if (typeof key === 'string' && key.startsWith('/api/ingredients/search')) {
      return { data: data.search };
    }
    if (key === '/api/measures') {
      return { data: data.measures };
    }
    return { data: undefined };
  };
}

describe('NewRecipe builder', () => {
  const push = jest.fn();

  beforeEach(() => {
    (fetch as jest.Mock).mockReset();
    push.mockReset();
    useRouter.mockReturnValue({ push, back: jest.fn() });
    useSWR.mockImplementation(swrByKey({ search: searchResults, measures: [grams, items] }));
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

  it('spawns a new empty ingredient row once one is picked', () => {
    render(<NewRecipe />);
    fireEvent.change(screen.getByLabelText('Ingredient 1'), { target: { value: 'oni' } });
    fireEvent.click(screen.getByRole('button', { name: /Onion/ }));
    // The picked row keeps the value, and a fresh empty row appears below it.
    expect(screen.getByLabelText('Ingredient 1')).toHaveValue('Onion');
    expect(screen.getByLabelText('Ingredient 2')).toBeInTheDocument();
  });

  it('spawns a new empty step once the trailing one is typed into', () => {
    render(<NewRecipe />);
    fireEvent.change(screen.getByLabelText('Step 1'), { target: { value: 'Chop' } });
    expect(screen.getByLabelText('Step 2')).toBeInTheDocument();
    expect(screen.queryByLabelText('Step 3')).not.toBeInTheDocument();
  });

  it('creates a brand-new ingredient inline and selects it', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ uuid: 'ing-new', name: 'Tamarind', measure: grams }),
    });

    render(<NewRecipe />);
    fireEvent.change(screen.getByLabelText('Ingredient 1'), { target: { value: 'Tamarind' } });
    fireEvent.click(screen.getByRole('button', { name: /Create/ }));

    fireEvent.change(screen.getByLabelText('Measure'), { target: { value: 'GRAMS' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/ingredients',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Tamarind', measureId: 'GRAMS' }),
        }),
      );
    });
    // The created ingredient is selected, which spawns the next empty row.
    expect(await screen.findByLabelText('Ingredient 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Ingredient 1')).toHaveValue('Tamarind');
  });

  it('saves: creates the recipe, attaches filled ingredients, then redirects', async () => {
    (fetch as jest.Mock).mockImplementation((url: string, opts: { method: string }) => {
      if (url === '/api/recipes' && opts.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ recipeId: 'full-id', recipeShortId: 'short-id' }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(<NewRecipe />);
    fireEvent.change(screen.getByLabelText('Recipe title'), { target: { value: 'Tacos' } });
    fireEvent.change(screen.getByLabelText('Ingredient 1'), { target: { value: 'beef' } });
    fireEvent.click(screen.getByRole('button', { name: /Beef/ }));
    fireEvent.change(screen.getByLabelText('Amount 1'), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText('Step 1'), { target: { value: 'Brown the beef' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save recipe' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/recipes',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Tacos', description: null, steps: ['Brown the beef'] }),
        }),
      );
      expect(fetch).toHaveBeenCalledWith(
        '/api/recipes/full-id/ingredients',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ ingredientId: 'ing-beef', amount: 500 }),
        }),
      );
      expect(push).toHaveBeenCalledWith('/recipes/short-id');
    });
  });

  it('blocks save when an ingredient is picked without an amount', async () => {
    render(<NewRecipe />);
    fireEvent.change(screen.getByLabelText('Recipe title'), { target: { value: 'Tacos' } });
    fireEvent.change(screen.getByLabelText('Ingredient 1'), { target: { value: 'beef' } });
    fireEvent.click(screen.getByRole('button', { name: /Beef/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Save recipe' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/amount greater than 0/);
    });
    expect(fetch).not.toHaveBeenCalledWith('/api/recipes', expect.anything());
  });

  it('surfaces an error when recipe creation fails', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: false });
    render(<NewRecipe />);
    fireEvent.change(screen.getByLabelText('Recipe title'), { target: { value: 'Tacos' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save recipe' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Failed to create recipe/);
    });
  });
});
