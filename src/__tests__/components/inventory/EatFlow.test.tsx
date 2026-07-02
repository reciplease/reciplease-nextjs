import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { SWRConfig } from 'swr';
import type { ReactNode } from 'react';
import EatFlow from '@/components/inventory/EatFlow';

jest.mock('next-auth/react');
jest.mock('next/router', () => ({ useRouter: jest.fn() }));

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
    if (url === '/api/fitbit/connection') {
      return Promise.resolve({ ok: true, json: async () => ({ connected }) });
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
  it('does not show the Fitbit matching section when Fitbit is not connected', async () => {
    mockConnection(false);
    renderFresh(<EatFlow uuid="uuid-1" item={item} onSaved={onSaved} />);
    openPanel();

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/fitbit/connection', undefined));
    expect(screen.queryByLabelText(/match to a fitbit food/i)).not.toBeInTheDocument();
  });

  it('plain remaining-decrement submit with no Fitbit connection', async () => {
    mockConnection(false);
    renderFresh(<EatFlow uuid="uuid-1" item={item} onSaved={onSaved} />);
    openPanel();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/fitbit/connection', undefined));

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
    // No Fitbit log call, since Fitbit isn't connected.
    expect(fetch).not.toHaveBeenCalledWith('/api/fitbit/foods/log', expect.anything());
  });

  it('full flow with search + match + Fitbit log call', async () => {
    jest.useFakeTimers();
    const foods = [
      { foodId: 1, name: 'Whole Milk', brand: 'Dairy Co', units: [{ id: 10, name: 'ml' }, { id: 11, name: 'cup' }] },
    ];
    (fetch as jest.Mock).mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/fitbit/connection') return Promise.resolve({ ok: true, json: async () => ({ connected: true }) });
      if (url.startsWith('/api/fitbit/foods/search')) return Promise.resolve({ ok: true, json: async () => foods });
      if (url === '/api/fitbit/foods/log') return Promise.resolve({ ok: true, json: async () => ({}) });
      if (url === '/api/inventory/uuid-1') return Promise.resolve({ ok: true, json: async () => ({}) });
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    renderFresh(<EatFlow uuid="uuid-1" item={item} onSaved={onSaved} />);
    openPanel();

    // Pre-filled with the item's name, which should trigger a debounced search.
    expect(await screen.findByLabelText(/match to a fitbit food/i)).toHaveValue('Milk');

    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    jest.useRealTimers();

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/fitbit/foods/search?query=Milk', undefined),
    );

    fireEvent.click(await screen.findByRole('button', { name: /whole milk/i }));

    fireEvent.change(screen.getByLabelText('Amount eaten'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const today = new Date().toISOString().slice(0, 10);
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/fitbit/foods/log',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ foodId: 1, unitId: 10, amount: 100, mealTypeId: 7, date: today }),
        }),
      );
    });
  });

  it('asks for confirmation and deletes the item when the amount eaten empties it out', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    mockConnection(false);
    renderFresh(<EatFlow uuid="uuid-1" item={item} onSaved={onSaved} />);
    openPanel();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/fitbit/connection', undefined));

    fireEvent.change(screen.getByLabelText('Amount eaten'), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/inventory/uuid-1', expect.objectContaining({ method: 'DELETE' }));
      expect(push).toHaveBeenCalledWith('/inventory');
    });
    confirmSpy.mockRestore();
  });

  it('does not delete when the confirmation is declined', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    mockConnection(false);
    renderFresh(<EatFlow uuid="uuid-1" item={item} onSaved={onSaved} />);
    openPanel();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/fitbit/connection', undefined));

    fireEvent.change(screen.getByLabelText('Amount eaten'), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(fetch).not.toHaveBeenCalledWith('/api/inventory/uuid-1', expect.anything());
    confirmSpy.mockRestore();
  });
});
