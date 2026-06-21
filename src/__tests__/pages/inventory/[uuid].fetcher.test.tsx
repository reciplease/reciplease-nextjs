import { render, screen, waitFor } from '@testing-library/react';
import InventoryItemPage, { getServerSideProps } from '@/pages/inventory/[uuid]';
import { GetServerSidePropsContext } from 'next';

jest.mock('next/link', () => ({ children, href }: { children: React.ReactNode; href: string }) => (
  <a href={href}>{children}</a>
));
jest.mock('@/components/Metadata', () => () => null);

global.fetch = jest.fn();

const item: InventoryItem = {
  uuid: 'uuid-1',
  name: 'Milk',
  measure: { measureId: 'ml', singular: 'millilitre', plural: 'millilitres', short: 'ml' },
  amount: 500,
  expiration: '2099-12-31',
};

describe('InventoryItemPage data fetching', () => {
  afterEach(() => (fetch as jest.Mock).mockReset());

  it('loads and displays the item from the API', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => item,
    });

    render(<InventoryItemPage uuid="uuid-1" />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('Milk')).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith('/api/inventory/uuid-1');
  });

  it('shows not found when the request fails', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: false });

    render(<InventoryItemPage uuid="uuid-2" />);

    await waitFor(() => expect(screen.getByText('Item not found')).toBeInTheDocument());
  });
});

describe('getServerSideProps', () => {
  it('passes the uuid route param through as a prop', () => {
    const context = { params: { uuid: 'abc-123' } } as unknown as GetServerSidePropsContext;

    expect(getServerSideProps(context)).toEqual({ props: { uuid: 'abc-123' } });
  });
});
