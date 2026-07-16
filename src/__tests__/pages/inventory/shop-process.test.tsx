import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProcessListPage from '@/pages/inventory/shop/process/index';

jest.mock('next/link', () => ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
  <a href={href} {...rest}>{children}</a>
));
jest.mock('next/router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/components/Metadata', () => () => null);
jest.mock('swr');
jest.mock('@/lib/houses', () => ({
  apiFetch: (...args: unknown[]) => (global.fetch as jest.Mock)(...args),
  useActiveHouse: () => ({ id: 'house-1', name: 'Home' }),
}));

const useSWR = require('swr').default;

global.fetch = jest.fn();

const pendingItems: PendingInventoryItem[] = [
  { uuid: 'p1', barcode: '1234567890123', expirationImage: 'ZXhw', measureImage: 'bWVhcw==' },
  { uuid: 'p2' },
];

describe('ProcessListPage', () => {
  const mutate = jest.fn();

  beforeEach(() => {
    (fetch as jest.Mock).mockReset();
    mutate.mockReset();
    useSWR.mockReturnValue({ data: pendingItems, mutate, isLoading: false });
  });

  it('lists pending items with their barcode and a link to process each', () => {
    render(<ProcessListPage />);

    expect(screen.getByText(/1234567890123/)).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: /Process/ });
    expect(links[0]).toHaveAttribute('href', '/inventory/shop/process/p1');
    expect(links[1]).toHaveAttribute('href', '/inventory/shop/process/p2');
  });

  it('shows an empty state when there is nothing to process', () => {
    useSWR.mockReturnValue({ data: [], mutate, isLoading: false });
    render(<ProcessListPage />);

    expect(screen.getByText(/Nothing to process/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to inventory/ })).toHaveAttribute('href', '/inventory');
  });

  it('discards a pending item and refreshes the list', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: true });
    render(<ProcessListPage />);

    fireEvent.click(screen.getAllByText('Discard')[0]);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/inventory/pending/p1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
    await waitFor(() => expect(mutate).toHaveBeenCalled());
  });
});
