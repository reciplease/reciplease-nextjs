import { render, screen } from '@testing-library/react';
import Layout from '@/components/Layout';

jest.mock('@/components/Header', () => () => <header>Header</header>);
jest.mock('@/components/RecipeFab', () => () => <div>RecipeFab</div>);
jest.mock('@/components/InventoryFab', () => () => <div>InventoryFab</div>);
jest.mock('@/components/PlannerFab', () => () => <div>PlannerFab</div>);
jest.mock('next/router', () => ({ useRouter: jest.fn() }));

const useRouter = require('next/router').useRouter as jest.Mock;

describe('Layout', () => {
  it('renders the header, content and recipe FAB outside the inventory section', () => {
    useRouter.mockReturnValue({ pathname: '/recipes' });

    render(
      <Layout>
        <p>Page content</p>
      </Layout>,
    );

    expect(screen.getByText('Header')).toBeInTheDocument();
    expect(screen.getByText('Page content')).toBeInTheDocument();
    expect(screen.getByText('RecipeFab')).toBeInTheDocument();
    expect(screen.queryByText('InventoryFab')).not.toBeInTheDocument();
  });

  it('applies the inventory theme and shows the inventory FAB on inventory pages', () => {
    useRouter.mockReturnValue({ pathname: '/inventory/scan' });

    const { container } = render(
      <Layout>
        <p>Page content</p>
      </Layout>,
    );

    expect(container.firstChild).toHaveClass('inventory-theme');
    expect(screen.getByText('InventoryFab')).toBeInTheDocument();
    expect(screen.queryByText('RecipeFab')).not.toBeInTheDocument();
  });

  it('hides the inventory FAB on the item detail page, which has its own eat-flow FAB', () => {
    useRouter.mockReturnValue({ pathname: '/inventory/[uuid]' });

    const { container } = render(
      <Layout>
        <p>Page content</p>
      </Layout>,
    );

    expect(container.firstChild).toHaveClass('inventory-theme');
    expect(screen.queryByText('InventoryFab')).not.toBeInTheDocument();
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
    expect(container.firstChild).not.toHaveClass('inventory-theme');
    expect(screen.getByText('PlannerFab')).toBeInTheDocument();
    expect(screen.queryByText('RecipeFab')).not.toBeInTheDocument();
  });
});
