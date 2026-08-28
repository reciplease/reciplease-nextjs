import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProcessDetailPage from '@/pages/pantry/shop/process/[uuid]';

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

const mockDecodeFromImageUrl = jest.fn();
jest.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: jest.fn().mockImplementation(() => ({
    decodeFromImageUrl: mockDecodeFromImageUrl,
  })),
}));

const useSWR = require('swr').default;
const { useRouter } = require('next/router');
const { suggestItemFromBarcode } = require('@/lib/suggestItemFromBarcode');

global.fetch = jest.fn();

const mockMeasures: Measure[] = [
  { measureId: 'g', singular: 'gram', plural: 'grams', short: 'g' },
];

const pendingItem: PendingPantryItem = {
  uuid: 'p1',
  barcodeImage: 'YmFyY29kZQ==',
  expirationImage: 'ZXhw',
  measureImage: 'bWVhcw==',
};

const push = jest.fn();

function setup(item: PendingPantryItem = pendingItem) {
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
      brand: 'Oatly',
      measureId: 'g',
      source: 'openfoodfacts',
      candidates: ['Oat Milk', 'Oatly Oat Milk'],
      brandCandidates: ['Oatly'],
      imageUrl: null,
    });
    mockDecodeFromImageUrl.mockReset();
    mockDecodeFromImageUrl.mockResolvedValue({ getText: () => '1234567890123' });
  });

  it('shows both captured photos and prefills the name from the decoded barcode', async () => {
    setup();

    expect(screen.getByAltText('Barcode photo')).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,YmFyY29kZQ==',
    );
    expect(screen.getByAltText('Expiration photo')).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,ZXhw',
    );
    expect(screen.getByAltText('Measure photo')).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,bWVhcw==',
    );
    await waitFor(() =>
      expect(mockDecodeFromImageUrl).toHaveBeenCalledWith('data:image/jpeg;base64,YmFyY29kZQ=='),
    );
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Oat Milk'));
    expect(suggestItemFromBarcode).toHaveBeenCalledWith('1234567890123');
  });

  it('shows placeholders and skips the lookup when nothing was captured', () => {
    setup({ uuid: 'p2' });

    expect(screen.getAllByText('No photo captured')).toHaveLength(2);
    expect(mockDecodeFromImageUrl).not.toHaveBeenCalled();
    expect(suggestItemFromBarcode).not.toHaveBeenCalled();
  });

  it('falls back to manual entry when the barcode photo cannot be decoded', async () => {
    mockDecodeFromImageUrl.mockRejectedValue(new Error('not found'));
    setup();

    const manualInput = await screen.findByLabelText(/enter it manually/);
    fireEvent.change(manualInput, { target: { value: '9998887776665' } });

    await waitFor(() => expect(suggestItemFromBarcode).toHaveBeenCalledWith('9998887776665'));
  });

  it('uses legacyBarcode directly for items captured before the photo-based flow, without attempting to decode', async () => {
    setup({ uuid: 'p2', legacyBarcode: '5012345678900', expirationImage: 'ZXhw' });

    expect(screen.getByText('5012345678900')).toBeInTheDocument();
    expect(mockDecodeFromImageUrl).not.toHaveBeenCalled();
    await waitFor(() => expect(suggestItemFromBarcode).toHaveBeenCalledWith('5012345678900'));
  });

  it('completes the pending item with a free-text month and advances straight to the next one in the backlog', async () => {
    (fetch as jest.Mock).mockImplementation((url: string) =>
      url === '/api/pantry/pending'
        ? Promise.resolve({ ok: true, json: async () => [{ uuid: 'p2' }] })
        : Promise.resolve({ ok: true, json: async () => ({}) }),
    );
    setup();
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Oat Milk'));

    // The suggested measure ('g') is already resolved into the combobox.
    expect(screen.getByText('gram / grams')).toBeInTheDocument();

    enterExpirationDate('01', 'JUN', '2027');
    fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: /Add to pantry/ }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/pantry/pending/p1/complete',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'Oat Milk',
            measure: 'g',
            amount: 500,
            expiration: '2027-06-01',
            brand: 'Oatly',
            barcode: '1234567890123',
          }),
        }),
      );
    });
    // Straight to the next backlog item, not back to the list.
    await waitFor(() => expect(push).toHaveBeenCalledWith('/pantry/shop/process/p2'));
  });

  it('returns to the list once the backlog is empty after completing', async () => {
    (fetch as jest.Mock).mockImplementation((url: string) =>
      url === '/api/pantry/pending'
        ? Promise.resolve({ ok: true, json: async () => [] })
        : Promise.resolve({ ok: true, json: async () => ({}) }),
    );
    setup();
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Oat Milk'));

    enterExpirationDate('01', 'JUN', '2027');
    fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: /Add to pantry/ }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/pantry/shop/process'));
  });

  it('has a small top-left button back to the shop backlog', async () => {
    setup();

    fireEvent.click(screen.getByRole('button', { name: /Back to shop/ }));

    expect(push).toHaveBeenCalledWith('/pantry/shop/process');
  });

  it('disables completion until name, measure, amount and expiration are all set', async () => {
    setup({ uuid: 'p2' });

    const complete = screen.getByRole('button', { name: /Add to pantry/ });
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
        '/api/pantry/pending/p1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/pantry/shop/process'));
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
      '/pantry/shop/process',
    );
  });
});
