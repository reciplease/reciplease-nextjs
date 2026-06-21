import { render, screen, waitFor } from '@testing-library/react';
import RecipePage from '@/pages/recipes/[recipeId]';
import { full } from '@/lib/recipe-id';

jest.mock('next/link', () => ({ children, href }: { children: React.ReactNode; href: string }) => (
  <a href={href}>{children}</a>
));
jest.mock('@/components/Metadata', () => () => null);
jest.mock('@/lib/houses', () => ({ useActiveHouse: () => undefined }));

global.fetch = jest.fn();

describe('RecipePage data fetching', () => {
  afterEach(() => (fetch as jest.Mock).mockReset());

  it('loads the recipe from the API', async () => {
    const recipeShortId = 'EREREREREREREREREREREQ';
    const recipe: Recipe = {
      recipeId: full(recipeShortId),
      recipeShortId,
      houseId: null,
      isPublic: true,
      name: 'Tacos',
      description: 'Tasty tacos',
      ingredients: [],
      steps: [],
    };
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => recipe,
    });

    render(<RecipePage recipeShortId={recipeShortId} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('Tacos')).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith(`/api/recipes/${full(recipeShortId)}`);
  });
});
