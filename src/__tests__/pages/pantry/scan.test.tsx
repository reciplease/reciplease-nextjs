import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ScanPage from '@/pages/pantry/scan';

// ── Mock scanner adapters ────────────────────────────────────────────────────
// Replace the real camera/ZXing/Tesseract components with simple test buttons
// that fire the same callbacks, so we test business logic without browser APIs.

jest.mock('@/components/scanner/BarcodeScanner', () =>
  function MockBarcodeScanner({ onDetected, active }: { onDetected: (b: string) => void; active: boolean }) {
    return (
      <button
        data-testid="barcode-scanner"
        disabled={!active}
        onClick={() => onDetected('1234567890123')}
      >
        Simulate barcode scan
      </button>
    );
  },
);

jest.mock('next/dynamic', () => (fn: () => Promise<{ default: unknown }>) => {
  let Component: React.ComponentType<any> | null = null;
  fn().then((mod) => { Component = (mod as any).default ?? mod; });
  return function DynamicMock(props: any) {
    return Component ? <Component {...props} /> : null;
  };
});

jest.mock('next/router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/components/Metadata', () => () => null);
jest.mock('@/lib/openfoodfacts', () => ({ lookupProduct: jest.fn() }));
jest.mock('swr');

const useSWR = require('swr').default;
const { lookupProduct } = require('@/lib/openfoodfacts');

global.fetch = jest.fn();

const mockMeasures: Measure[] = [
  { measureId: 'g', singular: 'gram', plural: 'grams', short: 'g' },
];

function setup() {
  useSWR.mockReturnValue({ data: mockMeasures, mutate: jest.fn() });
  (lookupProduct as jest.Mock).mockResolvedValue({
    nameCandidates: ['Oat Milk', 'Oatly Oat Milk'],
    brandCandidates: [],
    measureId: null,
  });
  return render(<ScanPage />);
}

// Drive: barcode scan → confirm-item (details) phase.
async function scanToDetails() {
  fireEvent.click(screen.getByTestId('barcode-scanner'));
  await waitFor(() => screen.getByText('Confirm item'));
}

function enterExpirationDate(date: string) {
  const [year, month, day] = date.split('-');
  fireEvent.change(screen.getByLabelText('Day'), { target: { value: day } });
  fireEvent.change(screen.getByLabelText('Month'), { target: { value: month } });
  fireEvent.change(screen.getByLabelText('Year'), { target: { value: year } });
  fireEvent.click(screen.getByText('Continue →'));
}

// Drive: details → expiration → the combined measure+amount phase.
async function advanceToMeasureAmount(date = '2027-06-01') {
  fireEvent.click(screen.getByText('Continue →'));
  enterExpirationDate(date);
  await waitFor(() => screen.getByText('Enter measure and amount'));
}

// Pick the single mock measure via the combobox.
function pickMeasure() {
  fireEvent.click(screen.getByText('Select measure…'));
  fireEvent.click(screen.getByText('gram / grams'));
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ScanPage', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockReset();
    (lookupProduct as jest.Mock).mockReset();
    useSWR.mockReturnValue({ data: mockMeasures, mutate: jest.fn() });
  });

  it('starts in barcode phase', () => {
    setup();
    expect(screen.getByText('Scan barcode')).toBeInTheDocument();
    expect(screen.getByTestId('barcode-scanner')).toBeInTheDocument();
  });

  it('looks up a manually entered barcode through the same flow', async () => {
    setup();
    fireEvent.change(screen.getByLabelText('Or enter a barcode manually'), {
      target: { value: '5012345678900' },
    });
    fireEvent.click(screen.getByText('Look up'));

    await waitFor(() => screen.getByText('Confirm item'));
    expect(lookupProduct).toHaveBeenCalledWith('5012345678900');
    expect(screen.getByLabelText('Name')).toHaveValue('Oat Milk');
    expect(screen.getByText(/Barcode: 5012345678900/)).toBeInTheDocument();
  });

  it('navigates back to pantry', () => {
    const push = jest.fn();
    jest.spyOn(require('next/router'), 'useRouter').mockReturnValue({ push });
    setup();
    fireEvent.click(screen.getByText('← Back to pantry'));
    expect(push).toHaveBeenCalledWith('/pantry');
  });

  it('shows no measure options while measures have not loaded', async () => {
    useSWR.mockReturnValue({ data: undefined, mutate: jest.fn() });
    (lookupProduct as jest.Mock).mockResolvedValue({ nameCandidates: ['Oat Milk'], brandCandidates: [], measureId: null });
    render(<ScanPage />);
    await scanToDetails();
    await advanceToMeasureAmount();

    fireEvent.click(screen.getByText('Select measure…'));
    expect(screen.getByText('No measures found')).toBeInTheDocument();
  });

  it('looks up the barcode when Enter is pressed in the manual field', async () => {
    setup();
    const input = screen.getByLabelText('Or enter a barcode manually');
    fireEvent.change(input, { target: { value: '5012345678900' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => screen.getByText('Confirm item'));
    expect(lookupProduct).toHaveBeenCalledWith('5012345678900');
  });

  it('does not look up the barcode for other key presses', () => {
    setup();
    const input = screen.getByLabelText('Or enter a barcode manually');
    fireEvent.change(input, { target: { value: '5012345678900' } });
    fireEvent.keyDown(input, { key: 'a' });

    expect(lookupProduct).not.toHaveBeenCalled();
    expect(screen.getByText('Scan barcode')).toBeInTheDocument();
  });

  it('pressing Enter with an empty manual barcode does nothing', () => {
    setup();
    const input = screen.getByLabelText('Or enter a barcode manually');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(lookupProduct).not.toHaveBeenCalled();
    expect(screen.getByText('Scan barcode')).toBeInTheDocument();
  });

  describe('after barcode scan', () => {
    it('prefills the name from Open Food Facts and records the barcode', async () => {
      setup();
      await scanToDetails();

      expect(screen.getByLabelText('Name')).toHaveValue('Oat Milk');
      expect(screen.getByText(/Barcode: 1234567890123/)).toBeInTheDocument();
    });

    it('leaves the name blank when Open Food Facts returns nothing', async () => {
      useSWR.mockReturnValue({ data: mockMeasures, mutate: jest.fn() });
      (lookupProduct as jest.Mock).mockResolvedValue({ nameCandidates: [], brandCandidates: [], measureId: null });
      render(<ScanPage />);
      await scanToDetails();

      expect(screen.getByLabelText('Name')).toHaveValue('');
    });

    it('pre-fills the measure+amount step with a measure parsed from the product quantity', async () => {
      useSWR.mockReturnValue({ data: mockMeasures, mutate: jest.fn() });
      (lookupProduct as jest.Mock).mockResolvedValue({
        nameCandidates: ['Flour'],
        brandCandidates: [],
        measureId: 'g',
      });
      render(<ScanPage />);
      await scanToDetails();
      await advanceToMeasureAmount();

      expect(screen.getByText('gram / grams')).toBeInTheDocument();
      expect(screen.getByLabelText('Amount (grams)')).toBeInTheDocument();
    });

    it('suggests the name and measure from a previously inventoried item with the same barcode', async () => {
      useSWR.mockReturnValue({ data: mockMeasures, mutate: jest.fn() });
      (fetch as jest.Mock).mockImplementation((url: string, opts?: { method?: string }) => {
        if (url === '/api/pantry' && opts?.method === undefined) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              {
                uuid: 'u1',
                name: 'Whole Milk',
                measure: mockMeasures[0].measureId,
                amount: 1,
                expiration: '2027-01-01',
                barcode: '1234567890123',
              },
            ],
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });
      render(<ScanPage />);
      await scanToDetails();

      expect(screen.getByLabelText('Name')).toHaveValue('Whole Milk');
      expect(
        screen.getByText('Suggested from a previous pantry item with this barcode.'),
      ).toBeInTheDocument();
      expect(lookupProduct).not.toHaveBeenCalled();

      await advanceToMeasureAmount();
      expect(screen.getByText('gram / grams')).toBeInTheDocument();
    });

    it('falls back to Open Food Facts when no pantry item matches the barcode', async () => {
      useSWR.mockReturnValue({ data: mockMeasures, mutate: jest.fn() });
      (lookupProduct as jest.Mock).mockResolvedValue({ nameCandidates: ['Oat Milk', 'Oatly Oat Milk'], brandCandidates: [], measureId: null });
      (fetch as jest.Mock).mockImplementation((url: string, opts?: { method?: string }) => {
        if (url === '/api/pantry' && opts?.method === undefined) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              {
                uuid: 'u1',
                name: 'Whole Milk',
                measure: mockMeasures[0].measureId,
                amount: 1,
                expiration: '2027-01-01',
                barcode: 'a-different-barcode',
              },
            ],
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });
      render(<ScanPage />);
      await scanToDetails();

      expect(lookupProduct).toHaveBeenCalledWith('1234567890123');
      expect(screen.getByLabelText('Name')).toHaveValue('Oat Milk');
    });

    it('falls back to Open Food Facts when the pantry lookup responds with an error', async () => {
      useSWR.mockReturnValue({ data: mockMeasures, mutate: jest.fn() });
      (lookupProduct as jest.Mock).mockResolvedValue({ nameCandidates: ['Oat Milk', 'Oatly Oat Milk'], brandCandidates: [], measureId: null });
      (fetch as jest.Mock).mockImplementation((url: string, opts?: { method?: string }) => {
        if (url === '/api/pantry' && opts?.method === undefined) {
          return Promise.resolve({ ok: false });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });
      render(<ScanPage />);
      await scanToDetails();

      expect(lookupProduct).toHaveBeenCalledWith('1234567890123');
      expect(screen.getByLabelText('Name')).toHaveValue('Oat Milk');
    });

    it('leaves the measure unset when Open Food Facts returns one we do not stock', async () => {
      useSWR.mockReturnValue({ data: mockMeasures, mutate: jest.fn() });
      (lookupProduct as jest.Mock).mockResolvedValue({ nameCandidates: ['Flour'], brandCandidates: [], measureId: 'kg' });
      render(<ScanPage />);
      await scanToDetails();
      await advanceToMeasureAmount();

      expect(screen.getByText('Select measure…')).toBeInTheDocument();
    });

    it('allows editing the suggested name directly', async () => {
      setup();
      await scanToDetails();

      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'My Custom Name' } });
      expect(screen.getByLabelText('Name')).toHaveValue('My Custom Name');
    });

    it('lets the user pick a different name from the Open Food Facts details', async () => {
      setup();
      await scanToDetails();

      // The brand-prefixed candidate is offered alongside the plain product name.
      fireEvent.click(screen.getByRole('button', { name: 'Oatly Oat Milk' }));
      expect(screen.getByLabelText('Name')).toHaveValue('Oatly Oat Milk');
    });

    it('Continue is disabled until the item has a name', async () => {
      useSWR.mockReturnValue({ data: mockMeasures, mutate: jest.fn() });
      (lookupProduct as jest.Mock).mockResolvedValue({ nameCandidates: [], brandCandidates: [], measureId: null });
      render(<ScanPage />);
      await scanToDetails();

      expect(screen.getByText('Continue →')).toBeDisabled();
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Oat Milk' } });
      expect(screen.getByText('Continue →')).not.toBeDisabled();
    });
  });

  describe('details → expiration → measure+amount → save', () => {
    async function advanceFromScan(date = '2027-06-01') {
      setup();
      await scanToDetails();
      await advanceToMeasureAmount(date);
    }

    it('asks for the expiration date as manual entry, not a camera scan', async () => {
      setup();
      await scanToDetails();
      fireEvent.click(screen.getByText('Continue →'));

      expect(screen.getByText('Enter expiration date')).toBeInTheDocument();
      expect(screen.getByLabelText('Expiration date')).toBeInTheDocument();
    });

    it('accepts a month name as printed on the packaging', async () => {
      setup();
      await scanToDetails();
      fireEvent.click(screen.getByText('Continue →'));

      fireEvent.change(screen.getByLabelText('Day'), { target: { value: '01' } });
      fireEvent.change(screen.getByLabelText('Month'), { target: { value: 'JUN' } });
      fireEvent.change(screen.getByLabelText('Year'), { target: { value: '2027' } });
      fireEvent.click(screen.getByText('Continue →'));

      await waitFor(() => screen.getByText('Enter measure and amount'));
      // Localized via formatDate — June 2027 confirms JUN resolved to month 06.
      expect(screen.getByText(/Jun.*2027|2027.*Jun/)).toBeInTheDocument();
    });

    it('asks for measure and amount together after the expiration date', async () => {
      await advanceFromScan();

      expect(screen.getByText('Oat Milk')).toBeInTheDocument();
      // Localized via formatDate (toLocaleDateString), not the raw ISO string.
      expect(screen.getByText(/Jun.*2027|2027.*Jun/)).toBeInTheDocument();
      expect(screen.getByText('Select measure…')).toBeInTheDocument();
      expect(screen.getByLabelText(/Amount/)).toBeInTheDocument();
    });

    it('Save is disabled until both measure and amount are set', async () => {
      await advanceFromScan();

      fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '250' } });
      expect(screen.getByText('Save')).toBeDisabled();

      pickMeasure();
      expect(screen.getByText('Save')).not.toBeDisabled();
    });

    it('posts the new flattened payload with barcode and resets', async () => {
      await advanceFromScan();
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      pickMeasure();
      fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '250' } });
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/pantry',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              name: 'Oat Milk',
              measure: 'g',
              amount: 250,
              expiration: '2027-06-01',
              barcode: '1234567890123',
            }),
          }),
        );
      });

      await waitFor(() => expect(screen.getByText('Scan barcode')).toBeInTheDocument());
    });

    it('shows an error when save fails', async () => {
      await advanceFromScan();
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: false });

      pickMeasure();
      fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '250' } });
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(screen.getByText('Failed to save. Please try again.')).toBeInTheDocument();
      });
    });

    it('shows an unexpected error message when save throws', async () => {
      await advanceFromScan();
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('network down'));

      pickMeasure();
      fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '250' } });
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(screen.getByText('Unexpected error.')).toBeInTheDocument();
      });
    });

    it('returns to the expiration phase when edit date is clicked', async () => {
      await advanceFromScan();

      fireEvent.click(screen.getByText('← Edit date'));

      expect(screen.getByText('Enter expiration date')).toBeInTheDocument();
      expect(screen.getByLabelText('Expiration date')).toBeInTheDocument();
    });

    it('hides the success flash 2 seconds after a successful save', async () => {
      await advanceFromScan();
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      pickMeasure();
      jest.useFakeTimers();
      try {
        fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '250' } });
        fireEvent.click(screen.getByText('Save'));

        await act(async () => {
          await Promise.resolve();
          await Promise.resolve();
          await Promise.resolve();
        });

        expect(screen.getByText('✓ Saved!')).toBeInTheDocument();

        act(() => jest.advanceTimersByTime(2000));

        expect(screen.queryByText('✓ Saved!')).not.toBeInTheDocument();
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
