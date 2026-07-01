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
  owned: false,
  isPublic: true,
  name: 'Toast',
  description: 'A staple and classic',
  ingredients: [],
  steps: [],
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
    render(<RecipePreview recipe={{ ...recipe, description: null }} />);
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
});
