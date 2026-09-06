import { render, screen, fireEvent } from '@testing-library/react';
import RecipePreview from './RecipePreview';

jest.mock(
  'next/link',
  () =>
    ({
      children,
      href,
      onClick,
    }: {
      children: React.ReactNode;
      href: string;
      onClick?: () => void;
    }) => (
      <a href={href} onClick={onClick}>
        {children}
      </a>
    ),
);

const recipe: Recipe = {
  recipeId: 'dbdc02be-a311-4aee-b974-c88d3c61f51b',
  recipeShortId: 'abc123',
  owned: 'false',
  isPublic: true,
  name: 'Toast',
  description: 'A staple and classic',
  sourceUrl: '',
  ingredients: [],
  steps: [],
  updatedAt: '2026-06-06T18:00:00Z',
  upvoteCount: 0,
  upvotedByCurrentUser: false,
};

const ownedRecipe: Recipe = {
  ...recipe,
  owned: 'true',
  isPublic: false,
};

describe('RecipePreview', () => {
  it('renders recipe name', () => {
    render(<RecipePreview recipe={recipe} />);
    expect(screen.getByText('Toast')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<RecipePreview recipe={recipe} />);
    expect(screen.getByText('A staple and classic')).toBeInTheDocument();
  });

  it('falls back when description is null', () => {
    render(<RecipePreview recipe={{ ...recipe, description: null as unknown as string }} />);
    expect(screen.getByText('No description found')).toBeInTheDocument();
  });

  it('links to the recipe detail page using the short ID', () => {
    render(<RecipePreview recipe={recipe} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/recipes/abc123');
  });

  it('shows a source link icon when the recipe has a source URL', () => {
    render(<RecipePreview recipe={{ ...recipe, sourceUrl: 'https://example.com' }} />);
    expect(screen.getByLabelText('Has source link')).toBeInTheDocument();
  });

  it('does not show a source link icon when the recipe has no source URL', () => {
    render(<RecipePreview recipe={recipe} />);
    expect(screen.queryByLabelText('Has source link')).not.toBeInTheDocument();
  });

  it('has no view-transition-name until clicked', () => {
    render(<RecipePreview recipe={recipe} />);
    expect(screen.getByText('Toast')).not.toHaveStyle({
      viewTransitionName: `recipe-title-${recipe.recipeId}`,
    });
  });

  it('sets a view-transition-name matching the recipe on click', () => {
    render(<RecipePreview recipe={recipe} />);
    fireEvent.click(screen.getByRole('link'));
    expect(screen.getByText('Toast')).toHaveStyle({
      viewTransitionName: `recipe-title-${recipe.recipeId}`,
    });
  });

  it('shows a passive Public badge for a public non-owned recipe', () => {
    render(<RecipePreview recipe={recipe} />);
    expect(screen.getByText('Public')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Make private' })).not.toBeInTheDocument();
  });

  it('shows a passive Private badge for a private non-owned recipe', () => {
    render(<RecipePreview recipe={{ ...recipe, isPublic: false }} />);
    expect(screen.getByText('Private')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Make public' })).not.toBeInTheDocument();
  });

  it('shows a Private toggle button for a private owned recipe', () => {
    render(<RecipePreview recipe={ownedRecipe} onToggleVisibility={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Make public' })).toBeInTheDocument();
  });

  it('shows a Public toggle button for a public owned recipe', () => {
    render(<RecipePreview recipe={{ ...ownedRecipe, isPublic: true }} onToggleVisibility={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Make private' })).toBeInTheDocument();
  });

  it('calls onToggleVisibility when the toggle is clicked', () => {
    const onToggle = jest.fn();
    render(<RecipePreview recipe={ownedRecipe} onToggleVisibility={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: 'Make public' }));
    expect(onToggle).toHaveBeenCalledWith(ownedRecipe);
  });

  it('does not navigate when the toggle is clicked', () => {
    const onToggle = jest.fn();
    render(<RecipePreview recipe={ownedRecipe} onToggleVisibility={onToggle} />);
    const link = screen.getByRole('link');
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    jest.spyOn(clickEvent, 'preventDefault');
    fireEvent.click(screen.getByRole('button', { name: 'Make public' }));
    expect(onToggle).toHaveBeenCalled();
  });

  it('shows a passive upvote count when no toggle handler is given', () => {
    render(<RecipePreview recipe={{ ...recipe, upvoteCount: 3 }} />);
    expect(screen.getByLabelText('3 upvotes')).toHaveTextContent('3');
    expect(screen.queryByRole('button', { name: 'Upvote' })).not.toBeInTheDocument();
  });

  it('shows an upvote button when a toggle handler is given', () => {
    render(<RecipePreview recipe={recipe} onToggleUpvote={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Upvote' })).toHaveTextContent('0');
  });

  it('marks an already-upvoted recipe as pressed', () => {
    render(<RecipePreview recipe={{ ...recipe, upvotedByCurrentUser: true }} onToggleUpvote={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Remove upvote' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onToggleUpvote when the upvote button is clicked', () => {
    const onToggle = jest.fn();
    render(<RecipePreview recipe={recipe} onToggleUpvote={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: 'Upvote' }));
    expect(onToggle).toHaveBeenCalledWith(recipe);
  });
});
