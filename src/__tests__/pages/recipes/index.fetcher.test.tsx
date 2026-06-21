import { render, screen, waitFor } from '@testing-library/react';
import Recipes from '@/pages/recipes';

jest.mock('next/link', () => ({ children, href }: { children: React.ReactNode; href: string }) => (
  <a href={href}>{children}</a>
));
jest.mock('@/components/Metadata', () => () => null);

global.fetch = jest.fn();

describe('Recipes list data fetching', () => {
  afterEach(() => (fetch as jest.Mock).mockReset());

  it('loads recipes from the API', async () => {
    const recipes: Recipe[] = [
      {
        recipeId: '333333333333333333333333',
        recipeShortId: 'short-3',
        name: 'Pizza',
        description: 'Cheesy pizza',
        ingredients: [],
        steps: [],
        houseId: null,
        isPublic: false,
      },
    ];
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => recipes,
    });

    render(<Recipes />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('Pizza')).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith('/api/recipes');
  });
});
