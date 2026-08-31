import { render, screen, waitFor } from '@testing-library/react';
import RecipePage from '@/pages/recipes/[recipeId]';
import { full } from '@/lib/recipe-id';

const RECIPE_SHORT_ID = 'EREREREREREREREREREREQ';

jest.mock('next/router', () => ({
  __esModule: true,
  default: { replace: jest.fn(), asPath: '/recipes' },
  useRouter: () => ({ isReady: true, query: { recipeId: 'EREREREREREREREREREREQ' } }),
}));
jest.mock('next/link', () => ({ children, href }: { children: React.ReactNode; href: string }) => (
  <a href={href}>{children}</a>
));
jest.mock('@/components/Metadata', () => () => null);
jest.mock('@/lib/houses', () => ({
  useActiveHouse: () => undefined,
  apiFetch: (url: string) => fetch(url),
}));

global.fetch = jest.fn();

describe('RecipePage data fetching', () => {
  afterEach(() => (fetch as jest.Mock).mockReset());

  it('loads the recipe from the API', async () => {
    const recipeId = full(RECIPE_SHORT_ID);
    (fetch as jest.Mock).mockImplementation((url: string) => {
      if (url === '/api/measures') return Promise.resolve({ ok: true, status: 200, json: async () => [] });
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          recipeId,
          isPublic: true,
          name: 'Tacos',
          description: 'Tasty tacos',
          ingredients: [],
          steps: [],
        }),
      });
    });

    render(<RecipePage />);

    await waitFor(() => expect(screen.getByText('Tacos')).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith(`/api/recipes/${recipeId}`);
  });
});
