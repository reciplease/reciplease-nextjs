import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProcessListPage from '@/pages/pantry/shop/process/index';

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

const pendingItems: PendingPantryItem[] = [
  {
    uuid: 'p1',
    barcodeImage: 'YmFyY29kZQ==',
    expirationImage: 'ZXhw',
    measureImage: 'bWVhcw==',
    updatedAt: '2026-08-17T10:15:00Z',
  },
  { uuid: 'p2' },
  { uuid: 'p3', legacyBarcode: '5012345678900' },
];

describe('ProcessListPage', () => {
  const mutate = jest.fn();

  beforeEach(() => {
    (fetch as jest.Mock).mockReset();
    mutate.mockReset();
    useSWR.mockReturnValue({ data: pendingItems, mutate, isLoading: false });
  });

  it('lists pending items with their barcode photo and a link to process each', () => {
    render(<ProcessListPage />);

    expect(screen.getByAltText('barcode photo')).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,YmFyY29kZQ==',
    );
    const links = screen.getAllByRole('link', { name: /Process/ });
    expect(links[0]).toHaveAttribute('href', '/pantry/shop/process/p1');
    expect(links[1]).toHaveAttribute('href', '/pantry/shop/process/p2');
  });

  it('shows a placeholder for a missing barcode photo', () => {
    render(<ProcessListPage />);

    expect(screen.getAllByText('No barcode photo')).toHaveLength(1);
  });

  it('shows the raw barcode number for an item captured before the photo-based flow', () => {
    render(<ProcessListPage />);

    expect(screen.getByText('5012345678900')).toBeInTheDocument();
  });

  it('shows the scan timestamp for a captured item', () => {
    render(<ProcessListPage />);

    expect(screen.getByText(new RegExp(`Scanned ${new Date('2026-08-17T10:15:00Z').toLocaleString().split(',')[0]}`)))
      .toBeInTheDocument();
  });

  it('puts the small Discard control after the Process link', () => {
    render(<ProcessListPage />);

    const row = screen.getAllByLabelText('Discard')[0].closest('li')!;
    const buttonsAndLinks = Array.from(row.querySelectorAll('a, button')).map(
      (el) => el.getAttribute('aria-label') ?? el.textContent,
    );
    expect(buttonsAndLinks.indexOf('Process')).toBeLessThan(buttonsAndLinks.indexOf('Discard'));
  });

  it('shows an empty state when there is nothing to process', () => {
    useSWR.mockReturnValue({ data: [], mutate, isLoading: false });
    render(<ProcessListPage />);

    expect(screen.getByText(/Nothing to process/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to pantry/ })).toHaveAttribute('href', '/pantry');
  });

  it('discards a pending item and refreshes the list', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: true });
    render(<ProcessListPage />);

    fireEvent.click(screen.getAllByLabelText('Discard')[0]);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/pantry/pending/p1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
    await waitFor(() => expect(mutate).toHaveBeenCalled());
  });
});
