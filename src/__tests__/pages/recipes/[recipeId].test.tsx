import { fireEvent, render, screen } from '@testing-library/react';
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
  ownership: {},
  isPublic: false,
  name: 'Tacos',
  description: 'Tasty tacos',
  sourceUrl: '',
  ingredients: [
    { name: 'Beef', measure: grams.measureId ?? 'GRAMS', amount: 500 },
    { name: 'Tortilla', measure: items.measureId ?? 'ITEMS', amount: 1 },
  ],
  method: { steps: ['Brown the beef', 'Warm the tortillas'] },
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
  it('shows prep time, cook time and servings when present', () => {
    mockRecipe({
      isLoading: false,
      data: { ...recipe, prepTimeMinutes: 5, cookTimeMinutes: 40, servings: 4 },
      error: undefined,
    });
    render(<RecipePage />);
    expect(screen.getByText('Prep 5 min · Cook 40 min · Serves 4')).toBeInTheDocument();
  });

  it('shows no timing line when none of the fields are set', () => {
    mockRecipe({ isLoading: false, data: recipe, error: undefined });
    render(<RecipePage />);
    expect(screen.queryByText(/Prep|Cook|Serves/)).not.toBeInTheDocument();
  });

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

  it('lets each ingredient be ticked off independently', () => {
    mockRecipe({ isLoading: false, data: recipe, error: undefined });
    render(<RecipePage />);

    const beef = screen.getByRole('checkbox', { name: 'Beef - 500 grams' });
    const tortilla = screen.getByRole('checkbox', { name: 'Tortilla - 1 item' });
    expect(beef).not.toBeChecked();

    fireEvent.click(beef);

    expect(beef).toBeChecked();
    expect(tortilla).not.toBeChecked();

    fireEvent.click(beef);

    expect(beef).not.toBeChecked();
  });

  it('renders a table recipe as a table instead of a numbered list', () => {
    const tableRecipe: Recipe = {
      ...recipe,
      method: { cells: [{ text: 'fry', handsOff: false, inputs: [{ text: 'beef', handsOff: false, inputs: [] }] }] },
    };
    mockRecipe({ isLoading: false, data: tableRecipe, error: undefined });
    render(<RecipePage />);

    expect(screen.getByRole('region', { name: 'Method' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'fry' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Method' })).not.toBeInTheDocument();
  });

  it('renders a list recipe as a numbered list', () => {
    mockRecipe({ isLoading: false, data: recipe, error: undefined });
    render(<RecipePage />);

    expect(screen.getByRole('list', { name: 'Method' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Method' })).not.toBeInTheDocument();
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
      data: { ...recipe, ownership: undefined },
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
        ownership: undefined,
        updatedAt: '2026-06-10T12:00:00.000Z',
      },
      error: undefined,
    });
    render(<RecipePage />);
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
  });

  it('shows who created and last updated the recipe to its owner', () => {
    mockRecipe({
      isLoading: false,
      data: {
        ...recipe,
        updatedAt: '2026-06-10T12:00:00.000Z',
        ownership: {
          createdBy: { userId: 'user-1', handle: 'alice' },
          updatedBy: { userId: 'user-2', handle: 'bob' },
        },
      },
      error: undefined,
    });
    render(<RecipePage />);
    expect(screen.getByText('Created by alice')).toBeInTheDocument();
    expect(screen.getByText(/Last updated:.* by bob/)).toBeInTheDocument();
  });

  it('shows neither creator nor updater to a non-owner', () => {
    mockRecipe({
      isLoading: false,
      data: { ...recipe, updatedAt: '2026-06-10T12:00:00.000Z', ownership: undefined },
      error: undefined,
    });
    render(<RecipePage />);
    expect(screen.queryByText(/Created by/)).not.toBeInTheDocument();
    expect(screen.getByText(/Last updated:/)).not.toHaveTextContent(/ by /);
  });

  it('omits the last updated line when absent', () => {
    mockRecipe({ isLoading: false, data: recipe, error: undefined });
    render(<RecipePage />);
    expect(screen.queryByText(/Last updated:/)).not.toBeInTheDocument();
  });
});
