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
    if (url === '/api/google-health/connection') {
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
  it('does not show the Google Health matching section when Google Health is not connected', async () => {
    mockConnection(false);
    renderFresh(<EatFlow uuid="uuid-1" item={item} onSaved={onSaved} />);
    openPanel();

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/google-health/connection', undefined));
    expect(screen.queryByLabelText(/match to a google health food/i)).not.toBeInTheDocument();
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

  it('full flow with search + match + Google Health log call', async () => {
    jest.useFakeTimers();
    const foods = [{ foodId: 'food-1', displayName: 'Whole Milk', brand: 'Dairy Co' }];
    (fetch as jest.Mock).mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/google-health/connection') return Promise.resolve({ ok: true, json: async () => ({ connected: true }) });
      if (url.startsWith('/api/google-health/foods/search')) return Promise.resolve({ ok: true, json: async () => foods });
      if (url === '/api/google-health/foods/log') return Promise.resolve({ ok: true, json: async () => ({}) });
      if (url === '/api/inventory/uuid-1') return Promise.resolve({ ok: true, json: async () => ({}) });
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    renderFresh(<EatFlow uuid="uuid-1" item={item} onSaved={onSaved} />);
    openPanel();

    // Pre-filled with the item's name, which should trigger a debounced search.
    expect(await screen.findByLabelText(/match to a google health food/i)).toHaveValue('Milk');

    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    jest.useRealTimers();

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/google-health/foods/search?query=Milk', undefined),
    );

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

  it('asks for confirmation and deletes the item when the amount eaten empties it out', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    mockConnection(false);
    renderFresh(<EatFlow uuid="uuid-1" item={item} onSaved={onSaved} />);
    openPanel();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/google-health/connection', undefined));

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
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/google-health/connection', undefined));

    fireEvent.change(screen.getByLabelText('Amount eaten'), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(fetch).not.toHaveBeenCalledWith('/api/inventory/uuid-1', expect.anything());
    confirmSpy.mockRestore();
  });
});
