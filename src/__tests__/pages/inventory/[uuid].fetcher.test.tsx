import { render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import type { ReactNode } from 'react';
import InventoryItemPage from '@/pages/inventory/[uuid]';

// Fresh SWR cache per render so one test's cached item can't leak into the next.
const renderFresh = (node: ReactNode) =>
  render(<SWRConfig value={{ provider: () => new Map() }}>{node}</SWRConfig>);

jest.mock('@/lib/houses', () => ({
  useActiveHouse: () => ({ id: 'h1', name: 'Home', role: 'OWNER' }),
  apiFetch: (url: string, init?: RequestInit) => fetch(url, init),
}));
jest.mock('next/router', () => ({
  useRouter: () => ({ isReady: true, query: { uuid: 'uuid-1' } }),
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
  remaining: 500,
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

    renderFresh(<InventoryItemPage />);

    await waitFor(() => expect(screen.getByText('Milk')).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith('/api/inventory/uuid-1', undefined);
  });

  it('shows not found when the request fails', async () => {
    mockFetchByUrl({ ok: false });

    renderFresh(<InventoryItemPage />);

    await waitFor(() => expect(screen.getByText('Item not found')).toBeInTheDocument());
  });
});
