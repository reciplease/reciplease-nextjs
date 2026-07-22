import { render, screen, waitFor } from '@testing-library/react';
import ExpiringInventory from '@/pages/inventory/expiring';

jest.mock('@/lib/houses', () => ({
  useActiveHouse: () => ({ id: 'h1', name: 'Home', role: 'OWNER' }),
  apiFetch: (url: string, init?: RequestInit) => fetch(url, init),
}));
jest.mock('next/link', () => ({ children, href }: { children: React.ReactNode; href: string }) => (
  <a href={href}>{children}</a>
));
jest.mock('@/components/Metadata', () => () => null);

global.fetch = jest.fn();

describe('ExpiringInventory data fetching', () => {
  afterEach(() => (fetch as jest.Mock).mockReset());

  it('asks the backend to exclude fully-consumed items, rather than filtering client-side', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [
        {
          uuid: 'uuid-1',
          name: 'Bread',
          measure: 'ITEMS',
          amount: 2,
          remaining: 2,
          expiration: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        },
      ],
    });

    render(<ExpiringInventory />);

    await waitFor(() => expect(screen.getByText('Bread')).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith('/api/inventory?excludeFullyConsumed=true', undefined);
  });
});
