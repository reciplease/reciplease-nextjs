import { render, screen, waitFor } from '@testing-library/react';
import InventoryItemPage, { getServerSideProps } from '@/pages/inventory/[uuid]';
import { GetServerSidePropsContext } from 'next';

jest.mock('@/lib/houses', () => ({
  useActiveHouse: () => ({ id: 'h1', name: 'Home', role: 'OWNER' }),
  apiFetch: (url: string, init?: RequestInit) => fetch(url, init),
}));
jest.mock('next/link', () => ({ children, href }: { children: React.ReactNode; href: string }) => (
  <a href={href}>{children}</a>
));
jest.mock('@/components/Metadata', () => () => null);

global.fetch = jest.fn();

const item: InventoryItem = {
  uuid: 'uuid-1',
  name: 'Milk',
  measure: 'ml',
  amount: 500,
  expiration: '2099-12-31',
};

const ML: Measure = { measureId: 'ml', singular: 'millilitre', plural: 'millilitres', short: 'ml' };

function mockFetchByUrl(itemResponse: { ok: boolean; json?: () => Promise<unknown> }) {
  (fetch as jest.Mock).mockImplementation((url: string) => {
    if (url === '/api/measures') return Promise.resolve({ ok: true, json: async () => [ML] });
    return Promise.resolve(itemResponse);
  });
}

describe('InventoryItemPage data fetching', () => {
  afterEach(() => (fetch as jest.Mock).mockReset());

  it('loads and displays the item from the API', async () => {
    mockFetchByUrl({ ok: true, json: async () => item });

    render(<InventoryItemPage uuid="uuid-1" />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('Milk')).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith('/api/inventory/uuid-1', undefined);
  });

  it('shows not found when the request fails', async () => {
    mockFetchByUrl({ ok: false });

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
