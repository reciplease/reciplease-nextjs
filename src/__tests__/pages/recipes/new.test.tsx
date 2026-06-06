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

describe('NewRecipe builder', () => {
  const push = jest.fn();

  beforeEach(() => {
    (fetch as jest.Mock).mockReset();
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
    fireEvent.change(screen.getByLabelText('Ingredient 1'), { target: { value: 'Beef' } });
    fireEvent.change(screen.getByLabelText('Measure 1'), { target: { value: 'GRAMS' } });
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
          body: JSON.stringify({ name: 'Beef', measure: 'GRAMS', amount: 500 }),
        }),
      );
      expect(push).toHaveBeenCalledWith('/recipes/short-id');
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
