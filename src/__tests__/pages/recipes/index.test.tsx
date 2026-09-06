import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Recipes from '@/pages/recipes';

jest.mock('swr');
jest.mock('next/link', () => ({ children, href }: { children: React.ReactNode; href: string }) => (
  <a href={href}>{children}</a>
));
jest.mock('@/components/Metadata', () => () => null);

const mockApiClientMutator = jest.fn();
jest.mock('@/lib/apiClientMutator', () => ({
  apiClientMutator: (...args: unknown[]) => mockApiClientMutator(...args),
  isSuccessResponse: (response: { status: number }) => response.status >= 200 && response.status < 300,
}));

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
    owned: 'true',
    isPublic: false,
    updatedAt: '2026-06-06T18:00:00Z',
    upvoteCount: 0,
    upvotedByCurrentUser: false,
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
    upvoteCount: 0,
    upvotedByCurrentUser: false,
  },
];

describe('Recipes list page', () => {
  it('shows loading state', () => {
    useSWR.mockReturnValue({ isLoading: true, data: undefined, error: undefined, mutate: jest.fn() });
    render(<Recipes />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows not found when error', () => {
    useSWR.mockReturnValue({ isLoading: false, data: undefined, error: new Error('fail'), mutate: jest.fn() });
    render(<Recipes />);
    expect(screen.getByText('No recipes found')).toBeInTheDocument();
  });

  it('shows not found when there are no recipes and no error', () => {
    useSWR.mockReturnValue({ isLoading: false, data: undefined, error: undefined, mutate: jest.fn() });
    render(<Recipes />);
    expect(screen.getByText('No recipes found')).toBeInTheDocument();
  });

  it('renders a preview for each recipe', () => {
    useSWR.mockReturnValue({ isLoading: false, data: recipes, error: undefined, mutate: jest.fn() });
    render(<Recipes />);

    expect(screen.getByRole('link', { name: /Tacos/ })).toHaveAttribute('href', '/recipes/short-1');
    expect(screen.getByText('Tasty tacos')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Soup/ })).toHaveAttribute('href', '/recipes/short-2');
    expect(screen.getByText('No description found')).toBeInTheDocument();
  });

  it('shows a Private toggle button for owned recipes', () => {
    useSWR.mockReturnValue({ isLoading: false, data: recipes, error: undefined, mutate: jest.fn() });
    render(<Recipes />);
    expect(screen.getByRole('button', { name: 'Make public' })).toBeInTheDocument();
  });

  it('shows a passive badge for non-owned recipes', () => {
    useSWR.mockReturnValue({ isLoading: false, data: recipes, error: undefined, mutate: jest.fn() });
    render(<Recipes />);
    expect(screen.getAllByText('Private').length).toBeGreaterThanOrEqual(1);
  });

  it('calls the upvote mutation and revalidates on click', async () => {
    mockApiClientMutator.mockResolvedValue({ data: undefined, status: 200, headers: new Headers() });
    const mutate = jest.fn();
    useSWR.mockReturnValue({ isLoading: false, data: recipes, error: undefined, mutate });
    render(<Recipes />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Upvote' })[0]);

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mockApiClientMutator).toHaveBeenCalledWith('/api/recipes/111111111111111111111111/upvote', expect.anything());
  });
});
