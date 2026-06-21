import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ScanPage from '@/pages/inventory/scan';

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

jest.mock('@/components/scanner/ExpirationScanner', () =>
  function MockExpirationScanner({ onDetected }: { onDetected: (d: string) => void }) {
    return (
      <button data-testid="expiration-scanner" onClick={() => onDetected('2027-06-01')}>
        Simulate expiration scan
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
    measureId: null,
  });
  return render(<ScanPage />);
}

// Drive: barcode scan → confirm-item (details) phase.
async function scanToDetails() {
  fireEvent.click(screen.getByTestId('barcode-scanner'));
  await waitFor(() => screen.getByText('Confirm item'));
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

  it('navigates back to inventory', () => {
    const push = jest.fn();
    jest.spyOn(require('next/router'), 'useRouter').mockReturnValue({ push });
    setup();
    fireEvent.click(screen.getByText('← Back to inventory'));
    expect(push).toHaveBeenCalledWith('/inventory');
  });

  it('shows no measure options while measures have not loaded', async () => {
    useSWR.mockReturnValue({ data: undefined, mutate: jest.fn() });
    (lookupProduct as jest.Mock).mockResolvedValue({ nameCandidates: ['Oat Milk'], measureId: null });
    render(<ScanPage />);
    await scanToDetails();

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
      (lookupProduct as jest.Mock).mockResolvedValue({ nameCandidates: [], measureId: null });
      render(<ScanPage />);
      await scanToDetails();

      expect(screen.getByLabelText('Name')).toHaveValue('');
    });

    it('suggests a measure parsed from the product quantity', async () => {
      useSWR.mockReturnValue({ data: mockMeasures, mutate: jest.fn() });
      (lookupProduct as jest.Mock).mockResolvedValue({
        nameCandidates: ['Flour'],
        measureId: 'g',
      });
      render(<ScanPage />);
      await scanToDetails();

      // The combobox shows the suggested measure, and Continue is enabled.
      expect(screen.getByText('gram / grams')).toBeInTheDocument();
      expect(screen.getByText('Continue →')).not.toBeDisabled();
    });

    it('suggests the name and measure from a previously inventoried item with the same barcode', async () => {
      useSWR.mockReturnValue({ data: mockMeasures, mutate: jest.fn() });
      (fetch as jest.Mock).mockImplementation((url: string, opts?: { method?: string }) => {
        if (url === '/api/inventory' && !opts) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              {
                uuid: 'u1',
                name: 'Whole Milk',
                measure: mockMeasures[0],
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
        screen.getByText('Suggested from a previous inventory item with this barcode.'),
      ).toBeInTheDocument();
      expect(screen.getByText('gram / grams')).toBeInTheDocument();
      expect(lookupProduct).not.toHaveBeenCalled();
    });

    it('falls back to Open Food Facts when no inventory item matches the barcode', async () => {
      useSWR.mockReturnValue({ data: mockMeasures, mutate: jest.fn() });
      (lookupProduct as jest.Mock).mockResolvedValue({ nameCandidates: ['Oat Milk', 'Oatly Oat Milk'], measureId: null });
      (fetch as jest.Mock).mockImplementation((url: string, opts?: { method?: string }) => {
        if (url === '/api/inventory' && !opts) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              {
                uuid: 'u1',
                name: 'Whole Milk',
                measure: mockMeasures[0],
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

    it('falls back to Open Food Facts when the inventory lookup responds with an error', async () => {
      useSWR.mockReturnValue({ data: mockMeasures, mutate: jest.fn() });
      (lookupProduct as jest.Mock).mockResolvedValue({ nameCandidates: ['Oat Milk', 'Oatly Oat Milk'], measureId: null });
      (fetch as jest.Mock).mockImplementation((url: string, opts?: { method?: string }) => {
        if (url === '/api/inventory' && !opts) {
          return Promise.resolve({ ok: false });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });
      render(<ScanPage />);
      await scanToDetails();

      expect(lookupProduct).toHaveBeenCalledWith('1234567890123');
      expect(screen.getByLabelText('Name')).toHaveValue('Oat Milk');
    });

    it('does not suggest a measure when Open Food Facts returns one we do not stock', async () => {
      useSWR.mockReturnValue({ data: mockMeasures, mutate: jest.fn() });
      (lookupProduct as jest.Mock).mockResolvedValue({ nameCandidates: ['Flour'], measureId: 'kg' });
      render(<ScanPage />);
      await scanToDetails();

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

    it('Continue is disabled until a measure is chosen', async () => {
      setup();
      await scanToDetails();
      expect(screen.getByText('Continue →')).toBeDisabled();
      pickMeasure();
      expect(screen.getByText('Continue →')).not.toBeDisabled();
    });
  });

  describe('details → expiration → amount → save', () => {
    async function advanceToAmount() {
      setup();
      await scanToDetails();
      pickMeasure();
      fireEvent.click(screen.getByText('Continue →'));
      fireEvent.click(screen.getByTestId('expiration-scanner'));
    }

    it('reaches the amount phase showing name, expiration and measure hint', async () => {
      await advanceToAmount();
      expect(screen.getByText('Oat Milk')).toBeInTheDocument();
      expect(screen.getByText(/2027-06-01/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Amount \(grams\)/)).toBeInTheDocument();
    });

    it('posts the new flattened payload with barcode and resets', async () => {
      await advanceToAmount();
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '250' } });
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/inventory',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              name: 'Oat Milk',
              measureId: 'g',
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
      await advanceToAmount();
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: false });

      fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '250' } });
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(screen.getByText('Failed to save. Please try again.')).toBeInTheDocument();
      });
    });

    it('shows an unexpected error message when save throws', async () => {
      await advanceToAmount();
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('network down'));

      fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '250' } });
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(screen.getByText('Unexpected error.')).toBeInTheDocument();
      });
    });

    it('returns to the expiration phase when rescan date is clicked', async () => {
      await advanceToAmount();

      fireEvent.click(screen.getByText('← Rescan date'));

      expect(screen.getByText('Scan expiration date')).toBeInTheDocument();
      expect(screen.getByTestId('expiration-scanner')).toBeInTheDocument();
    });

    it('hides the success flash 2 seconds after a successful save', async () => {
      await advanceToAmount();
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) });

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

  describe('manual expiration entry', () => {
    it('allows entering the expiration date manually', async () => {
      setup();
      await scanToDetails();
      pickMeasure();
      fireEvent.click(screen.getByText('Continue →'));

      const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
      fireEvent.change(dateInput, { target: { value: '2027-03-15' } });
      fireEvent.click(screen.getByText('Use this date →'));

      await waitFor(() => screen.getByText(/2027-03-15/));
    });
  });
});
