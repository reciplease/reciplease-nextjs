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
});
