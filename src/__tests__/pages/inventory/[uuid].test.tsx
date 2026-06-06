import { render, screen } from '@testing-library/react';
import InventoryItemPage from '@/pages/inventory/[uuid]';

jest.mock('swr');
jest.mock('next/link', () => ({ children, href }: { children: React.ReactNode; href: string }) => (
  <a href={href}>{children}</a>
));
jest.mock('@/components/Metadata', () => () => null);

const useSWR = require('swr').default;

const item: InventoryItem = {
  uuid: 'uuid-1',
  name: 'Milk',
  measure: { measureId: 'ml', singular: 'millilitre', plural: 'millilitres', short: 'ml' },
  amount: 500,
  expiration: '2099-12-31',
};

describe('InventoryItemPage', () => {
  it('shows loading state', () => {
    useSWR.mockReturnValue({ isLoading: true, data: undefined, error: undefined });
    render(<InventoryItemPage uuid="uuid-1" />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows not found when error', () => {
    useSWR.mockReturnValue({ isLoading: false, data: undefined, error: new Error('fail') });
    render(<InventoryItemPage uuid="uuid-1" />);
    expect(screen.getByText('Item not found')).toBeInTheDocument();
  });

  it('renders item name and amount', () => {
    useSWR.mockReturnValue({ isLoading: false, data: item, error: undefined });
    render(<InventoryItemPage uuid="uuid-1" />);
    expect(screen.getByText('Milk')).toBeInTheDocument();
    expect(screen.getByText(/500 millilitres/)).toBeInTheDocument();
  });

  it('shows singular measure when amount is 1', () => {
    useSWR.mockReturnValue({
      isLoading: false,
      data: { ...item, amount: 1 },
      error: undefined,
    });
    render(<InventoryItemPage uuid="uuid-1" />);
    expect(screen.getByText(/1 millilitre/)).toBeInTheDocument();
  });
});
