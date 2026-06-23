import { render, screen, waitFor } from '@testing-library/react';
import EditRecipe from '@/pages/recipes/[recipeId]/edit';
import { full } from '@/lib/recipe-id';

jest.mock('next/router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));
jest.mock('next/link', () => ({ children, href }: { children: React.ReactNode; href: string }) => (
  <a href={href}>{children}</a>
));
jest.mock('@/components/Metadata', () => () => null);
jest.mock('@/lib/houses', () => ({
  useActiveHouse: () => ({ id: 'house-1', name: 'Bayview Gardens', role: 'OWNER' }),
  apiFetch: (url: string, init: RequestInit = {}) => fetch(url, init),
}));

global.fetch = jest.fn();

describe('EditRecipe data fetching', () => {
  afterEach(() => (fetch as jest.Mock).mockReset());

  it('loads the recipe from the API', async () => {
    const recipeShortId = 'EREREREREREREREREREREI';
    const recipe: Recipe = {
      recipeId: full(recipeShortId),
      recipeShortId,
      houseId: 'house-1',
      isPublic: false,
      name: 'Tacos',
      description: 'Tasty tacos',
      ingredients: [],
      steps: [],
    };
    (fetch as jest.Mock).mockImplementation((url: string) => {
      if (url === `/api/recipes/${full(recipeShortId)}`) {
        return Promise.resolve({ ok: true, json: async () => recipe });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    render(<EditRecipe recipeShortId={recipeShortId} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByLabelText('Recipe title')).toHaveValue('Tacos'));
    expect(fetch).toHaveBeenCalledWith(`/api/recipes/${full(recipeShortId)}`, expect.anything());
  });
});
