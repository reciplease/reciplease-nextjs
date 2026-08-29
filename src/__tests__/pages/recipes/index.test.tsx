import { render, screen } from '@testing-library/react';
import Recipes from '@/pages/recipes';

jest.mock('swr');
jest.mock('next/link', () => ({ children, href }: { children: React.ReactNode; href: string }) => (
  <a href={href}>{children}</a>
));
jest.mock('@/components/Metadata', () => () => null);

const useSWR = require('swr').default;

const recipes: Recipe[] = [
  {
    recipeId: '111111111111111111111111',
    recipeShortId: 'short-1',
    name: 'Tacos',
    description: 'Tasty tacos',
    sourceUrl: '',
    ingredients: [],
    steps: [],
    owned: 'false',
    isPublic: false,
    updatedAt: '2026-06-06T18:00:00Z',
  },
  {
    recipeId: '222222222222222222222222',
    recipeShortId: 'short-2',
    name: 'Soup',
    description: null as unknown as string,
    sourceUrl: '',
    ingredients: [],
    steps: [],
    owned: 'false',
    isPublic: false,
    updatedAt: '2026-06-06T18:00:00Z',
  },
];

describe('Recipes list page', () => {
  it('shows loading state', () => {
    useSWR.mockReturnValue({ isLoading: true, data: undefined, error: undefined });
    render(<Recipes />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows not found when error', () => {
    useSWR.mockReturnValue({ isLoading: false, data: undefined, error: new Error('fail') });
    render(<Recipes />);
    expect(screen.getByText('No recipes found')).toBeInTheDocument();
  });

  it('shows not found when there are no recipes and no error', () => {
    useSWR.mockReturnValue({ isLoading: false, data: undefined, error: undefined });
    render(<Recipes />);
    expect(screen.getByText('No recipes found')).toBeInTheDocument();
  });

  it('renders a preview for each recipe', () => {
    useSWR.mockReturnValue({ isLoading: false, data: recipes, error: undefined });
    render(<Recipes />);

    expect(screen.getByRole('link', { name: /Tacos/ })).toHaveAttribute('href', '/recipes/short-1');
    expect(screen.getByText('Tasty tacos')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Soup/ })).toHaveAttribute('href', '/recipes/short-2');
    expect(screen.getByText('No description found')).toBeInTheDocument();
  });
});
