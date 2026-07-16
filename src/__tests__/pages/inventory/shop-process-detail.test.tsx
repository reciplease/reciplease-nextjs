import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProcessDetailPage from '@/pages/inventory/shop/process/[uuid]';

jest.mock('next/link', () => ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
  <a href={href} {...rest}>{children}</a>
));
jest.mock('next/router', () => ({ useRouter: jest.fn() }));
jest.mock('@/components/Metadata', () => () => null);
jest.mock('swr');
jest.mock('@/lib/houses', () => ({
  apiFetch: (...args: unknown[]) => (global.fetch as jest.Mock)(...args),
  useActiveHouse: () => ({ id: 'house-1', name: 'Home' }),
}));
jest.mock('@/lib/suggestItemFromBarcode', () => ({ suggestItemFromBarcode: jest.fn() }));

const useSWR = require('swr').default;
const { useRouter } = require('next/router');
const { suggestItemFromBarcode } = require('@/lib/suggestItemFromBarcode');

global.fetch = jest.fn();

const mockMeasures: Measure[] = [
  { measureId: 'g', singular: 'gram', plural: 'grams', short: 'g' },
];

const pendingItem: PendingInventoryItem = {
  uuid: 'p1',
  barcode: '1234567890123',
  expirationImage: 'ZXhw',
  measureImage: 'bWVhcw==',
};

const push = jest.fn();

function setup(item: PendingInventoryItem = pendingItem) {
  useSWR.mockImplementation((key: unknown) =>
    key === '/api/measures'
      ? { data: mockMeasures, isLoading: false, mutate: jest.fn() }
      : { data: item, isLoading: false, mutate: jest.fn() },
  );
  return render(<ProcessDetailPage />);
}

function enterExpirationDate(day: string, month: string, year: string) {
  fireEvent.change(screen.getByLabelText('Day'), { target: { value: day } });
  fireEvent.change(screen.getByLabelText('Month'), { target: { value: month } });
  fireEvent.change(screen.getByLabelText('Year'), { target: { value: year } });
}

function pickMeasure() {
  fireEvent.click(screen.getByText('Select measure…'));
  fireEvent.click(screen.getByText('gram / grams'));
}

describe('ProcessDetailPage', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockReset();
    push.mockReset();
    (useRouter as jest.Mock).mockReturnValue({ isReady: true, query: { uuid: 'p1' }, push });
    (suggestItemFromBarcode as jest.Mock).mockReset();
    (suggestItemFromBarcode as jest.Mock).mockResolvedValue({
      name: 'Oat Milk',
      measureId: 'g',
      source: 'openfoodfacts',
      candidates: ['Oat Milk', 'Oatly Oat Milk'],
      imageUrl: null,
    });
  });

  it('shows both captured photos and prefills the name from the barcode suggestion', async () => {
    setup();

    expect(screen.getByAltText('Expiration photo')).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,ZXhw',
    );
    expect(screen.getByAltText('Measure photo')).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,bWVhcw==',
    );
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Oat Milk'));
    expect(suggestItemFromBarcode).toHaveBeenCalledWith('1234567890123');
  });

  it('shows placeholders and skips the lookup when nothing was captured', () => {
    setup({ uuid: 'p2' });

    expect(screen.getAllByText('No photo captured')).toHaveLength(2);
    expect(suggestItemFromBarcode).not.toHaveBeenCalled();
  });

  it('completes the pending item with a free-text month and navigates back to the list', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
    setup();
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Oat Milk'));

    // The suggested measure ('g') is already resolved into the combobox.
    expect(screen.getByText('gram / grams')).toBeInTheDocument();

    enterExpirationDate('01', 'JUN', '2027');
    fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: /Add to inventory/ }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/inventory/pending/p1/complete',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'Oat Milk',
            measure: 'g',
            amount: 500,
            expiration: '2027-06-01',
            barcode: '1234567890123',
          }),
        }),
      );
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/inventory/shop/process'));
  });

  it('disables completion until name, measure, amount and expiration are all set', async () => {
    setup({ uuid: 'p2' });

    const complete = screen.getByRole('button', { name: /Add to inventory/ });
    expect(complete).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Beans' } });
    enterExpirationDate('01', '02', '2027');
    pickMeasure();
    expect(complete).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '2' } });
    expect(complete).not.toBeDisabled();
  });

  it('discards the pending item and navigates back to the list', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: true });
    setup();

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/inventory/pending/p1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/inventory/shop/process'));
  });

  it('shows a not-found state when the pending item is gone', () => {
    useSWR.mockImplementation((key: unknown) =>
      key === '/api/measures'
        ? { data: mockMeasures, isLoading: false, mutate: jest.fn() }
        : { data: undefined, error: new Error('Not found'), isLoading: false, mutate: jest.fn() },
    );
    render(<ProcessDetailPage />);

    expect(screen.getByText(/already been processed or discarded/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to the list/ })).toHaveAttribute(
      'href',
      '/inventory/shop/process',
    );
  });
});
