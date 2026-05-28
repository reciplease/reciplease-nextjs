import { render, screen } from '@testing-library/react';
import RecipePreview from './RecipePreview';

jest.mock('next/link', () => ({ children, href }: { children: React.ReactNode; href: string }) => (
  <a href={href}>{children}</a>
));

const recipe: Recipe = {
  recipeId: 'dbdc02be-a311-4aee-b974-c88d3c61f51b',
  recipeShortId: 'abc123',
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
});
