import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NewRecipe from '@/pages/recipes/new';
import { shorten } from '@/lib/recipe-id';

jest.mock('swr');
jest.mock('next/router', () => ({ useRouter: jest.fn() }));
jest.mock('@/components/Metadata', () => () => null);
jest.mock('@/lib/houses', () => ({ apiFetch: (url: string, init?: RequestInit) => fetch(url, init) }));

const useSWR = require('swr').default as jest.Mock;
const useRouter = require('next/router').useRouter as jest.Mock;
global.fetch = jest.fn();

const grams: Measure = { measureId: 'GRAMS', singular: 'gram', plural: 'grams', short: 'g' };
const items: Measure = { measureId: 'ITEMS', singular: 'item', plural: 'items', short: 'item' };

const RECIPE_ID = '111111111111111111111111';
const RECIPE_SHORT_ID = shorten(RECIPE_ID);

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
    (fetch as jest.Mock).mockImplementation((url: string, opts: { method: string }) => {
      if (url === '/api/recipes' && opts.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ recipeId: RECIPE_ID }),
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
          body: JSON.stringify({ name: 'Tacos', description: null, steps: ['Brown the beef'], isPublic: false }),
        }),
      );
      expect(fetch).toHaveBeenCalledWith(
        `/api/recipes/${RECIPE_ID}/ingredients`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ name: 'Beef', measure: 'GRAMS', amount: 500 }),
        }),
      );
      expect(push).toHaveBeenCalledWith(`/recipes/${RECIPE_SHORT_ID}`);
    });
  });

  it('defaults the ingredient measure to the first available measure when none is selected', async () => {
    (fetch as jest.Mock).mockImplementation((url: string, opts: { method: string }) => {
      if (url === '/api/recipes' && opts.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ recipeId: RECIPE_ID }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(<NewRecipe />);
    fireEvent.change(screen.getByLabelText('Recipe title'), { target: { value: 'Tacos' } });
    fireEvent.change(screen.getByLabelText('Ingredient 1'), { target: { value: 'Beef' } });
    fireEvent.change(screen.getByLabelText('Amount 1'), { target: { value: '500' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save recipe' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        `/api/recipes/${RECIPE_ID}/ingredients`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ name: 'Beef', measure: 'GRAMS', amount: 500 }),
        }),
      );
    });
  });

  it('defaults the ingredient measure to an empty string when no measures are available', async () => {
    useSWR.mockReturnValue({ data: undefined });
    (fetch as jest.Mock).mockImplementation((url: string, opts: { method: string }) => {
      if (url === '/api/recipes' && opts.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ recipeId: RECIPE_ID }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(<NewRecipe />);
    fireEvent.change(screen.getByLabelText('Recipe title'), { target: { value: 'Tacos' } });
    fireEvent.change(screen.getByLabelText('Ingredient 1'), { target: { value: 'Beef' } });
    fireEvent.change(screen.getByLabelText('Amount 1'), { target: { value: '500' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save recipe' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        `/api/recipes/${RECIPE_ID}/ingredients`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ name: 'Beef', measure: '', amount: 500 }),
        }),
      );
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

  it('surfaces an error when an ingredient cannot be attached', async () => {
    (fetch as jest.Mock).mockImplementation((url: string, opts: { method: string }) => {
      if (url === '/api/recipes' && opts.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ recipeId: RECIPE_ID }),
        });
      }
      return Promise.resolve({ ok: false });
    });

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
