import { render, screen, waitFor } from '@testing-library/react';
import InventoryList from '@/pages/inventory';

jest.mock('next/link', () => ({ children, href }: { children: React.ReactNode; href: string }) => (
  <a href={href}>{children}</a>
));
jest.mock('@/components/Metadata', () => () => null);

global.fetch = jest.fn();

describe('InventoryList data fetching', () => {
  afterEach(() => (fetch as jest.Mock).mockReset());

  it('loads inventory items from the API', async () => {
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

    render(<InventoryList />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('Bread')).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith('/api/inventory', expect.anything());
  });
});
