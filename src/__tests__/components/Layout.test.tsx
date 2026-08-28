import { render, screen } from '@testing-library/react';
import Layout from '@/components/Layout';

jest.mock('@/components/Header', () => () => <header>Header</header>);
jest.mock('@/components/RecipeFab', () => () => <div>RecipeFab</div>);
jest.mock('@/components/PantryFab', () => () => <div>PantryFab</div>);
jest.mock('@/components/PlannerFab', () => () => <div>PlannerFab</div>);
jest.mock('next/router', () => ({ useRouter: jest.fn() }));

const useRouter = require('next/router').useRouter as jest.Mock;

describe('Layout', () => {
  it('renders the header, content and recipe FAB outside the pantry section', () => {
    useRouter.mockReturnValue({ pathname: '/recipes' });

    render(
      <Layout>
        <p>Page content</p>
      </Layout>,
    );

    expect(screen.getByText('Header')).toBeInTheDocument();
    expect(screen.getByText('Page content')).toBeInTheDocument();
    expect(screen.getByText('RecipeFab')).toBeInTheDocument();
    expect(screen.queryByText('PantryFab')).not.toBeInTheDocument();
  });

  it('applies the pantry theme and shows the pantry FAB on pantry pages', () => {
    useRouter.mockReturnValue({ pathname: '/pantry/scan' });

    const { container } = render(
      <Layout>
        <p>Page content</p>
      </Layout>,
    );

    expect(container.firstChild).toHaveClass('pantry-theme');
    expect(screen.getByText('PantryFab')).toBeInTheDocument();
    expect(screen.queryByText('RecipeFab')).not.toBeInTheDocument();
  });

  it('hides the pantry FAB on the item detail page, which has its own eat-flow FAB', () => {
    useRouter.mockReturnValue({ pathname: '/pantry/[uuid]' });

    const { container } = render(
      <Layout>
        <p>Page content</p>
      </Layout>,
    );

    expect(container.firstChild).toHaveClass('pantry-theme');
    expect(screen.queryByText('PantryFab')).not.toBeInTheDocument();
    expect(screen.queryByText('RecipeFab')).not.toBeInTheDocument();
  });

  it('applies the planner theme (dark blue) on planner pages', () => {
    useRouter.mockReturnValue({ pathname: '/planner' });

    const { container } = render(
      <Layout>
        <p>Page content</p>
      </Layout>,
    );

    expect(container.firstChild).toHaveClass('planner-theme');
    expect(container.firstChild).not.toHaveClass('pantry-theme');
    expect(screen.getByText('PlannerFab')).toBeInTheDocument();
    expect(screen.queryByText('RecipeFab')).not.toBeInTheDocument();
  });
});
