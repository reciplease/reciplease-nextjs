import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditInventoryItem from '@/pages/inventory/[uuid]/edit';

jest.mock('swr');
jest.mock('@/lib/houses', () => ({
  useActiveHouse: () => ({ id: 'h1', name: 'Home', role: 'OWNER' }),
  apiFetch: (url: string, init?: RequestInit) => fetch(url, init),
}));
jest.mock('next/router', () => ({ useRouter: jest.fn() }));
jest.mock('next/link', () => ({ children, href }: { children: React.ReactNode; href: string }) => (
  <a href={href}>{children}</a>
));
jest.mock('@/components/Metadata', () => () => null);

const useSWR = require('swr').default as jest.Mock;
const useRouter = require('next/router').useRouter as jest.Mock;
global.fetch = jest.fn();

const grams: Measure = { measureId: 'GRAMS', singular: 'gram', plural: 'grams', short: 'g' };
const items: Measure = { measureId: 'ITEMS', singular: 'item', plural: 'items', short: 'item' };

const uuid = 'b465af6e-2465-4436-84c1-14f35db68dbf';

const item: InventoryItem = {
  uuid,
  name: 'Bread',
  measure: items.measureId,
  amount: 1,
  expiration: '2099-12-31',
  barcode: '0123456789012',
};

function mockItemSWR(result: { isLoading: boolean; data: InventoryItem | undefined; error: Error | undefined }) {
  useSWR.mockImplementation((url: string) => {
    if (url === '/api/measures') return { data: [grams, items], isLoading: false };
    return result;
  });
}

describe('EditInventoryItem page', () => {
  const push = jest.fn();

  beforeEach(() => {
    (fetch as jest.Mock).mockReset();
    push.mockReset();
    useRouter.mockReturnValue({ push });
  });

  it('shows loading state', () => {
    mockItemSWR({ isLoading: true, data: undefined, error: undefined });
    render(<EditInventoryItem uuid={uuid} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows not found when the item fails to load', () => {
    mockItemSWR({ isLoading: false, data: undefined, error: new Error('nope') });
    render(<EditInventoryItem uuid={uuid} />);
    expect(screen.getByText('Item not found')).toBeInTheDocument();
  });

  it('pre-populates the form from the existing item', () => {
    mockItemSWR({ isLoading: false, data: item, error: undefined });
    render(<EditInventoryItem uuid={uuid} />);
    expect(screen.getByLabelText('Name')).toHaveValue('Bread');
    expect(screen.getByLabelText('Amount')).toHaveValue(1);
    expect(screen.getByLabelText('Expiration date')).toHaveValue('2099-12-31');
    expect(screen.getByLabelText(/Barcode/)).toHaveValue('0123456789012');
  });

  it('submits a PUT with the updated fields and redirects to the detail page', async () => {
    mockItemSWR({ isLoading: false, data: item, error: undefined });
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });

    render(<EditInventoryItem uuid={uuid} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Sourdough' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '2' } });
    fireEvent.submit(screen.getByRole('button', { name: /save changes/i }).closest('form')!);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        `/api/inventory/${uuid}`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            name: 'Sourdough',
            measureId: 'ITEMS',
            amount: 2,
            expiration: '2099-12-31',
            barcode: '0123456789012',
          }),
        }),
      );
      expect(push).toHaveBeenCalledWith(`/inventory/${uuid}`);
    });
  });

  it('shows an error message when the save fails', async () => {
    mockItemSWR({ isLoading: false, data: item, error: undefined });
    (fetch as jest.Mock).mockResolvedValue({ ok: false });

    render(<EditInventoryItem uuid={uuid} />);
    fireEvent.submit(screen.getByRole('button', { name: /save changes/i }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to save changes. Please try again.');
    });
  });

  describe('delete', () => {
    let confirmSpy: jest.SpyInstance;

    beforeEach(() => {
      confirmSpy = jest.spyOn(window, 'confirm');
    });

    afterEach(() => {
      confirmSpy.mockRestore();
    });

    it('does nothing if the confirmation is declined', () => {
      confirmSpy.mockReturnValue(false);
      mockItemSWR({ isLoading: false, data: item, error: undefined });

      render(<EditInventoryItem uuid={uuid} />);
      fireEvent.click(screen.getByRole('button', { name: /delete item/i }));

      expect(fetch).not.toHaveBeenCalled();
    });

    it('deletes the item and redirects to the inventory list when confirmed', async () => {
      confirmSpy.mockReturnValue(true);
      mockItemSWR({ isLoading: false, data: item, error: undefined });
      (fetch as jest.Mock).mockResolvedValue({ ok: true });

      render(<EditInventoryItem uuid={uuid} />);
      fireEvent.click(screen.getByRole('button', { name: /delete item/i }));

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          `/api/inventory/${uuid}`,
          expect.objectContaining({ method: 'DELETE' }),
        );
        expect(push).toHaveBeenCalledWith('/inventory');
      });
    });

    it('shows an error message when the delete fails', async () => {
      confirmSpy.mockReturnValue(true);
      mockItemSWR({ isLoading: false, data: item, error: undefined });
      (fetch as jest.Mock).mockResolvedValue({ ok: false });

      render(<EditInventoryItem uuid={uuid} />);
      fireEvent.click(screen.getByRole('button', { name: /delete item/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Failed to delete item. Please try again.');
      });
    });
  });
});
