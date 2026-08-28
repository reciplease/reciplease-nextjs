import { render, screen, waitFor } from '@testing-library/react';
import PantryList from '@/pages/pantry';

jest.mock('@/lib/houses', () => ({
  useActiveHouse: () => ({ id: 'h1', name: 'Home', role: 'OWNER' }),
  usePendingCapturedItemsCount: () => 0,
  apiFetch: (url: string, init?: RequestInit) => fetch(url, init),
}));
jest.mock('next/link', () => ({ children, href }: { children: React.ReactNode; href: string }) => (
  <a href={href}>{children}</a>
));
jest.mock('@/components/Metadata', () => () => null);

global.fetch = jest.fn();

describe('PantryList data fetching', () => {
  afterEach(() => (fetch as jest.Mock).mockReset());

  it('loads pantry items from the API', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [
        {
          uuid: 'uuid-1',
          name: 'Bread',
          measure: 'ITEMS',
          amount: 2,
          expiration: '2099-12-31',
        },
      ],
    });

    render(<PantryList />);

    await waitFor(() => expect(screen.getByText('Bread')).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith('/api/pantry', undefined);
  });
});
