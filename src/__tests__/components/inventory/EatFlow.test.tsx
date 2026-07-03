import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { SWRConfig } from 'swr';
import type { ReactNode } from 'react';
import EatFlow from '@/components/inventory/EatFlow';

jest.mock('next-auth/react');
jest.mock('next/router', () => ({ useRouter: jest.fn() }));

jest.mock('@/components/scanner/BarcodeScanner', () => ({
  __esModule: true,
  default: ({ onDetected }: { onDetected: (barcode: string) => void }) => (
    <button type="button" onClick={() => onDetected('012345')}>
      mock-detect-barcode
    </button>
  ),
}));

const { useSession } = require('next-auth/react');
const useRouter = require('next/router').useRouter as jest.Mock;

jest.mock('@/lib/houses', () => ({
  apiFetch: (url: string, init?: RequestInit) => fetch(url, init),
}));

global.fetch = jest.fn();

const renderFresh = (node: ReactNode) =>
  render(<SWRConfig value={{ provider: () => new Map() }}>{node}</SWRConfig>);

const item: InventoryItem = {
  uuid: 'uuid-1',
  name: 'Milk',
  measure: 'ml',
  amount: 500,
  remaining: 500,
  expiration: '2099-12-31',
};

const push = jest.fn();
const onSaved = jest.fn();

function mockConnection(connected: boolean) {
  (fetch as jest.Mock).mockImplementation((url: string) => {
    if (url === '/api/google-health/connection') {
      return Promise.resolve({ ok: true, json: async () => ({ connected }) });
    }
    if (url.startsWith('/api/food/search')) {
      return Promise.resolve({ ok: true, json: async () => [] });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

function openPanel() {
  fireEvent.click(screen.getByRole('button', { name: 'Log eaten' }));
}

beforeEach(() => {
  (fetch as jest.Mock).mockReset();
  push.mockReset();
  onSaved.mockReset();
  useSession.mockReturnValue({ status: 'authenticated', data: {} });
  useRouter.mockReturnValue({ push });
});

describe('EatFlow', () => {
  it('shows the food search section even when Google Health is not connected', async () => {
    mockConnection(false);
    renderFresh(<EatFlow uuid="uuid-1" item={item} onSaved={onSaved} />);
    openPanel();

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/google-health/connection', undefined));
    expect(screen.getByLabelText(/match to a food/i)).toBeInTheDocument();
  });

  it('plain remaining-decrement submit with no Google Health connection', async () => {
    mockConnection(false);
    renderFresh(<EatFlow uuid="uuid-1" item={item} onSaved={onSaved} />);
    openPanel();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/google-health/connection', undefined));

    fireEvent.change(screen.getByLabelText('Amount eaten'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/inventory/uuid-1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            name: 'Milk',
            measure: 'ml',
            amount: 500,
            remaining: 400,
            expiration: '2099-12-31',
          }),
        }),
      );
      expect(onSaved).toHaveBeenCalled();
    });
    // No Google Health log call, since Google Health isn't connected.
    expect(fetch).not.toHaveBeenCalledWith('/api/google-health/foods/log', expect.anything());
  });

  it('full flow with a history match (identified food, no nutrients) and Google Health log call', async () => {
    jest.useFakeTimers();
    const results = [{ source: 'HISTORY', displayName: 'Whole Milk', identifiedFoodId: 'food-1', nutrients: null }];
    (fetch as jest.Mock).mockImplementation((url: string) => {
      if (url === '/api/google-health/connection') return Promise.resolve({ ok: true, json: async () => ({ connected: true }) });
      if (url.startsWith('/api/food/search')) return Promise.resolve({ ok: true, json: async () => results });
      if (url === '/api/google-health/foods/log') return Promise.resolve({ ok: true, json: async () => ({}) });
      if (url === '/api/inventory/uuid-1') return Promise.resolve({ ok: true, json: async () => ({}) });
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    renderFresh(<EatFlow uuid="uuid-1" item={item} onSaved={onSaved} />);
    openPanel();

    // Pre-filled with the item's name, which should trigger a debounced search.
    expect(await screen.findByLabelText(/match to a food/i)).toHaveValue('Milk');

    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    jest.useRealTimers();

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/food/search?query=Milk', undefined),
    );

    expect(await screen.findByText('Recently eaten')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: /whole milk/i }));

    fireEvent.change(screen.getByLabelText('Amount eaten'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const today = new Date().toISOString().slice(0, 10);
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/google-health/foods/log',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            foodId: 'food-1',
            foodDisplayName: 'Whole Milk',
            mealType: 'BREAKFAST',
            date: today,
            amount: 100,
          }),
        }),
      );
    });
  });

  it('full flow with a catalog match (anonymous food, nutrients attached) and Google Health log call', async () => {
    jest.useFakeTimers();
    const nutrients = { energyKcal: 60.0, proteinG: 3.0, fatG: 3.0, carbohydrateG: 5.0 };
    const results = [{ source: 'CATALOG', displayName: 'Whole Milk (Store Brand)', identifiedFoodId: null, nutrients }];
    (fetch as jest.Mock).mockImplementation((url: string) => {
      if (url === '/api/google-health/connection') return Promise.resolve({ ok: true, json: async () => ({ connected: true }) });
      if (url.startsWith('/api/food/search')) return Promise.resolve({ ok: true, json: async () => results });
      if (url === '/api/google-health/foods/log') return Promise.resolve({ ok: true, json: async () => ({}) });
      if (url === '/api/inventory/uuid-1') return Promise.resolve({ ok: true, json: async () => ({}) });
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    renderFresh(<EatFlow uuid="uuid-1" item={item} onSaved={onSaved} />);
    openPanel();
    await screen.findByLabelText(/match to a food/i);

    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    jest.useRealTimers();

    fireEvent.click(await screen.findByRole('button', { name: /whole milk \(store brand\)/i }));

    fireEvent.change(screen.getByLabelText('Amount eaten'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const today = new Date().toISOString().slice(0, 10);
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/google-health/foods/log',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            foodDisplayName: 'Whole Milk (Store Brand)',
            mealType: 'BREAKFAST',
            date: today,
            amount: 100,
            nutrients,
          }),
        }),
      );
    });
  });

  it('scanning a barcode selects the matched food', async () => {
    (fetch as jest.Mock).mockImplementation((url: string) => {
      if (url === '/api/google-health/connection') return Promise.resolve({ ok: true, json: async () => ({ connected: false }) });
      if (url.startsWith('/api/food/search')) return Promise.resolve({ ok: true, json: async () => [] });
      if (url === '/api/food/barcode/012345') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ source: 'CATALOG', displayName: 'Oat Milk', identifiedFoodId: null, nutrients: null }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    renderFresh(<EatFlow uuid="uuid-1" item={item} onSaved={onSaved} />);
    openPanel();
    await screen.findByLabelText(/match to a food/i);

    fireEvent.click(screen.getByRole('button', { name: 'Scan barcode' }));
    fireEvent.click(await screen.findByText('mock-detect-barcode'));

    expect(await screen.findByText('Oat Milk')).toBeInTheDocument();
  });

  it('clamps remaining to zero (never deletes) when the amount eaten empties it out', async () => {
    mockConnection(false);
    renderFresh(<EatFlow uuid="uuid-1" item={item} onSaved={onSaved} />);
    openPanel();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/google-health/connection', undefined));

    // More than what's left — should clamp to 0, not go negative.
    fireEvent.change(screen.getByLabelText('Amount eaten'), { target: { value: '600' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/inventory/uuid-1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            name: 'Milk',
            measure: 'ml',
            amount: 500,
            remaining: 0,
            expiration: '2099-12-31',
          }),
        }),
      );
      expect(onSaved).toHaveBeenCalled();
    });
    expect(fetch).not.toHaveBeenCalledWith('/api/inventory/uuid-1', expect.objectContaining({ method: 'DELETE' }));
    expect(push).not.toHaveBeenCalled();
  });
});
