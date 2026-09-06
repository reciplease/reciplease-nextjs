import { render, screen } from '@testing-library/react';
import RecipePage from '@/pages/recipes/[recipeId]';

jest.mock('swr');
jest.mock('next/router', () => ({
  useRouter: () => ({ isReady: true, query: { recipeId: 'EREREREREREREREREREREQ' } }),
}));
jest.mock('next/link', () => ({ children, href }: { children: React.ReactNode; href: string }) => (
  <a href={href}>{children}</a>
));
jest.mock('@/components/Metadata', () => () => null);

const useSWR = require('swr').default;

const grams: Measure = { measureId: 'GRAMS', singular: 'gram', plural: 'grams', short: 'g' };
const items: Measure = { measureId: 'ITEMS', singular: 'item', plural: 'items', short: 'item' };

const recipe: Recipe = {
  recipeId: '111111111111111111111111',
  recipeShortId: 'EREREREREREREREREREREQ',
  owned: 'true',
  createdBy: undefined,
  updatedBy: undefined,
  isPublic: false,
  name: 'Tacos',
  description: 'Tasty tacos',
  sourceUrl: '',
  ingredients: [
    { name: 'Beef', measure: grams.measureId ?? 'GRAMS', amount: 500 },
    { name: 'Tortilla', measure: items.measureId ?? 'ITEMS', amount: 1 },
  ],
  steps: ['Brown the beef', 'Warm the tortillas'],
  updatedAt: '',
  upvoteCount: 0,
  upvotedByCurrentUser: false,
};

function mockRecipe(state: { isLoading: boolean; data: Recipe | undefined; error: Error | undefined }) {
  useSWR.mockImplementation((key: string) => {
    if (key === '/api/measures') return { data: [grams, items], isLoading: false };
    return state;
  });
}

describe('RecipePage', () => {
  it('shows loading state', () => {
    mockRecipe({ isLoading: true, data: undefined, error: undefined });
    render(<RecipePage />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows not found when error', () => {
    mockRecipe({ isLoading: false, data: undefined, error: new Error('fail') });
    render(<RecipePage />);
    expect(screen.getByText('No recipe found')).toBeInTheDocument();
    expect(screen.getByText(JSON.stringify(new Error('fail')))).toBeInTheDocument();
  });

  it('shows not found when there is no recipe and no error', () => {
    mockRecipe({ isLoading: false, data: undefined, error: undefined });
    render(<RecipePage />);
    expect(screen.getByText('No recipe found')).toBeInTheDocument();
  });

  it('renders the recipe with ingredients (plural and singular) and steps', () => {
    mockRecipe({ isLoading: false, data: recipe, error: undefined });
    render(<RecipePage />);

    expect(screen.getByText('Tacos')).toBeInTheDocument();
    expect(screen.getByText('Tasty tacos')).toBeInTheDocument();
    expect(screen.getByText('Beef - 500 grams')).toBeInTheDocument();
    expect(screen.getByText('Tortilla - 1 item')).toBeInTheDocument();
    expect(screen.getByText('Brown the beef')).toBeInTheDocument();
    expect(screen.getByText('Warm the tortillas')).toBeInTheDocument();
  });

  it('shows an edit link when the caller owns the recipe', () => {
    mockRecipe({ isLoading: false, data: recipe, error: undefined });
    render(<RecipePage />);
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      '/recipes/EREREREREREREREREREREQ/edit',
    );
  });

  it('does not show an edit link when the recipe is not owned', () => {
    mockRecipe({
      isLoading: false,
      data: { ...recipe, owned: 'false' as const },
      error: undefined,
    });
    render(<RecipePage />);
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('shows the last updated timestamp when present', () => {
    mockRecipe({
      isLoading: false,
      data: {
        ...recipe,
        owned: 'false' as const,
        updatedAt: '2026-06-10T12:00:00.000Z',
      },
      error: undefined,
    });
    render(<RecipePage />);
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
  });

  it('omits the last updated line when absent', () => {
    mockRecipe({ isLoading: false, data: recipe, error: undefined });
    render(<RecipePage />);
    expect(screen.queryByText(/Last updated:/)).not.toBeInTheDocument();
  });
});
