import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NewPlannedMeal from '@/pages/planner/new';

jest.mock('swr');
jest.mock('next/router', () => ({ useRouter: jest.fn() }));
jest.mock('@/components/Metadata', () => () => null);
jest.mock('@/lib/houses', () => ({
  useActiveHouse: () => ({ id: 'h1', name: 'Home', role: 'OWNER' }),
  apiFetch: (url: string, init?: RequestInit) => fetch(url, init),
}));

const useSWR = require('swr').default as jest.Mock;
const useRouter = require('next/router').useRouter as jest.Mock;
global.fetch = jest.fn();

const grams: Measure = { measureId: 'g', singular: 'gram', plural: 'grams', short: 'g' };
const items: Measure = { measureId: 'item', singular: 'item', plural: 'items', short: 'item' };

const mockRecipe: Recipe = {
  recipeId: 'recipe-1',
  recipeShortId: 'r1',
  owned: 'true',
  houseId: 'h1',
  createdBy: undefined,
  updatedBy: undefined,
  isPublic: false,
  name: 'Toast',
  description: '',
  sourceUrl: '',
  ingredients: [{ name: 'bread', measure: items.measureId ?? 'item', amount: 2 }],
  steps: [],
  updatedAt: '2026-06-06T18:00:00Z',
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
    (fetch as jest.Mock).mockReset();
    push.mockReset();
    useRouter.mockReturnValue({ push, back: jest.fn() });
    useSWR.mockImplementation((key: unknown) => {
      const k = Array.isArray(key) ? key[0] : key;
      if (k === '/api/recipes') return { data: [mockRecipe] };
      if (k === '/api/pantry') return { data: [mockPantryItem] };
      if (k === '/api/measures') return { data: [grams, items] };
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
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });

    render(<NewPlannedMeal />);
    fireEvent.change(screen.getByLabelText('Meal name'), { target: { value: 'Dinner' } });
    fireEvent.click(screen.getByRole('button', { name: 'Plan meal' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/planner'));

    expect(fetch).toHaveBeenCalledWith('/api/planned-meals', expect.objectContaining({ method: 'POST' }));
  });

  it('shows an error message when the request fails', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: false, json: async () => ({ message: 'A meal named \'Dinner\' is already planned for this date' }) });

    render(<NewPlannedMeal />);
    fireEvent.change(screen.getByLabelText('Meal name'), { target: { value: 'Dinner' } });
    fireEvent.click(screen.getByRole('button', { name: 'Plan meal' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("already planned for this date");
  });
});
