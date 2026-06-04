import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function DynamicMock(props: any) {
    return Component ? <Component {...props} /> : null;
  };
});

jest.mock('next/router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/components/Metadata', () => () => null);
jest.mock('@/lib/openfoodfacts', () => ({ lookupBarcode: jest.fn() }));
jest.mock('swr');

const useSWR = require('swr').default;
const { lookupBarcode } = require('@/lib/openfoodfacts');

global.fetch = jest.fn();

const mockIngredient: Ingredient = {
  uuid: 'ing-1',
  name: 'Oat Milk',
  measure: { measureId: 'ML', singular: 'millilitre', plural: 'millilitres' },
};

const mockMeasures: Measure[] = [
  { measureId: 'GRAMS', singular: 'gram', plural: 'grams' },
];

function setup() {
  useSWR.mockReturnValue({ data: mockMeasures, mutate: jest.fn() });
  (lookupBarcode as jest.Mock).mockResolvedValue({ productName: 'Oat Milk', brands: 'Oatly' });
  return render(<ScanPage />);
}

async function scanBarcode(matches: Ingredient[] = [mockIngredient]) {
  (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => matches });
  fireEvent.click(screen.getByTestId('barcode-scanner'));
  await waitFor(() => screen.getByText('Select ingredient'));
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ScanPage', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockReset();
    (lookupBarcode as jest.Mock).mockReset();
    useSWR.mockReturnValue({ data: mockMeasures, mutate: jest.fn() });
  });

  it('starts in barcode phase', () => {
    setup();
    expect(screen.getByText('Scan barcode')).toBeInTheDocument();
    expect(screen.getByTestId('barcode-scanner')).toBeInTheDocument();
  });

  it('shows back to inventory button', () => {
    setup();
    expect(screen.getByText('← Back to inventory')).toBeInTheDocument();
  });

  it('navigates back to inventory', () => {
    const push = jest.fn();
    jest.spyOn(require('next/router'), 'useRouter').mockReturnValue({ push });
    setup();
    fireEvent.click(screen.getByText('← Back to inventory'));
    expect(push).toHaveBeenCalledWith('/inventory');
  });

  describe('after barcode scan', () => {
    it('opens ingredient modal with suggested name and matches', async () => {
      setup();
      (lookupBarcode as jest.Mock).mockResolvedValue({ productName: 'Oat Milk', brands: 'Oatly' });
      await scanBarcode([mockIngredient]);

      expect(screen.getByText('Select ingredient')).toBeInTheDocument();
      // suggestedName appears in subtitle; match name appears in list button
      expect(screen.getAllByText('Oat Milk').length).toBeGreaterThanOrEqual(1);
    });

    it('shows no-match message when search returns empty', async () => {
      (lookupBarcode as jest.Mock).mockResolvedValue({ productName: 'Unknown Thing', brands: '' });
      setup();
      await scanBarcode([]);

      expect(screen.getByText('No matching ingredients found.')).toBeInTheDocument();
    });

    it('always shows "+ Create ingredient" in the modal', async () => {
      (lookupBarcode as jest.Mock).mockResolvedValue({ productName: 'Oat Milk', brands: '' });
      setup();
      await scanBarcode([mockIngredient]);

      expect(screen.getByText('+ Create ingredient')).toBeInTheDocument();
    });

    it('uses barcode string as suggested name when Open Food Facts returns nothing', async () => {
      setup();
      (lookupBarcode as jest.Mock).mockResolvedValue(null);
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => [] });
      fireEvent.click(screen.getByTestId('barcode-scanner'));
      await waitFor(() => screen.getByText('Select ingredient'));

      expect(screen.getByText('1234567890123')).toBeInTheDocument();
    });
  });

  describe('ingredient selection → expiration phase', () => {
    it('advances to expiration phase when an existing ingredient is selected', async () => {
      (lookupBarcode as jest.Mock).mockResolvedValue({ productName: 'Oat Milk', brands: '' });
      setup();
      await scanBarcode();

      fireEvent.click(screen.getByRole('button', { name: /Oat Milk/i }));

      expect(screen.getByText('Scan expiration date')).toBeInTheDocument();
      expect(screen.getByTestId('expiration-scanner')).toBeInTheDocument();
    });

    it('closes modal and resumes barcode scanner when cancel is clicked', async () => {
      (lookupBarcode as jest.Mock).mockResolvedValue({ productName: 'Oat Milk', brands: '' });
      setup();
      await scanBarcode();

      fireEvent.click(screen.getByText('✕ Cancel scan'));

      expect(screen.getByText('Scan barcode')).toBeInTheDocument();
    });
  });

  describe('expiration phase', () => {
    beforeEach(async () => {
      (lookupBarcode as jest.Mock).mockResolvedValue({ productName: 'Oat Milk', brands: '' });
      setup();
      await scanBarcode();
      fireEvent.click(screen.getByRole('button', { name: /Oat Milk/i }));
    });

    it('advances to amount phase when scanner fires a date', () => {
      fireEvent.click(screen.getByTestId('expiration-scanner'));
      expect(screen.getByText('Enter amount')).toBeInTheDocument();
    });

    it('advances to amount phase when manual date is entered and confirmed', () => {
      fireEvent.change(screen.getByDisplayValue(''), { target: { value: '2027-12-31' } });
      fireEvent.click(screen.getByText('Use this date →'));
      expect(screen.getByText('Enter amount')).toBeInTheDocument();
    });

    it('"Use this date" button is hidden until a date is entered', () => {
      expect(screen.queryByText('Use this date →')).not.toBeInTheDocument();
    });
  });

  describe('amount phase', () => {
    beforeEach(async () => {
      (lookupBarcode as jest.Mock).mockResolvedValue({ productName: 'Oat Milk', brands: '' });
      setup();
      await scanBarcode();
      fireEvent.click(screen.getByRole('button', { name: /Oat Milk/i }));
      fireEvent.click(screen.getByTestId('expiration-scanner'));
    });

    it('shows ingredient name, expiration and measure hint', () => {
      expect(screen.getByText('Oat Milk')).toBeInTheDocument();
      expect(screen.getByText(/2027-06-01/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Amount \(millilitres\)/)).toBeInTheDocument();
    });

    it('Save button is disabled until amount is entered', () => {
      expect(screen.getByText('Save')).toBeDisabled();
    });

    it('posts correct payload and resets to barcode phase on success', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '250' } });
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/inventory',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ ingredientUuid: 'ing-1', amount: 250, expiration: '2027-06-01' }),
          }),
        );
      });

      await waitFor(() => expect(screen.getByText('Scan barcode')).toBeInTheDocument());
    });

    it('shows error message when save fails', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: false });

      fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '250' } });
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(screen.getByText('Failed to save. Please try again.')).toBeInTheDocument();
      });
    });

    it('"Rescan date" goes back to expiration phase', () => {
      fireEvent.click(screen.getByText('← Rescan date'));
      expect(screen.getByText('Scan expiration date')).toBeInTheDocument();
    });
  });
});
