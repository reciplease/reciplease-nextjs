import { render, screen, waitFor } from '@testing-library/react';
import Recipes from '@/pages/recipes';

jest.mock('next/router', () => ({ replace: jest.fn(), asPath: '/recipes' }));
jest.mock('next/link', () => ({ children, href }: { children: React.ReactNode; href: string }) => (
  <a href={href}>{children}</a>
));
jest.mock('@/components/Metadata', () => () => null);

global.fetch = jest.fn();

describe('Recipes list data fetching', () => {
  afterEach(() => (fetch as jest.Mock).mockReset());

  it('loads recipes from the API', async () => {
    const recipes = [
      {
        recipeId: '333333333333333333333333',
        name: 'Pizza',
        description: 'Cheesy pizza',
        ingredients: [],
        steps: [],
        owned: 'false',
        isPublic: false,
      },
    ];
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => recipes,
    });

    render(<Recipes />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('Pizza')).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith('/api/recipes', expect.anything());
  });
});
