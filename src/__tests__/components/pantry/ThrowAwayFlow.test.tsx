import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ThrowAwayFlow from '@/components/pantry/ThrowAwayFlow';

jest.mock('@/lib/houses', () => ({
  apiFetch: (url: string, init?: RequestInit) => fetch(url, init),
}));

global.fetch = jest.fn();

const item: PantryItem = {
  uuid: 'uuid-1',
  name: 'Milk',
  measure: 'ml',
  amount: 500,
  remaining: 500,
  expiration: '2000-01-01',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const onSaved = jest.fn();

function openPanel() {
  fireEvent.click(screen.getByRole('button', { name: 'Throw away' }));
}

beforeEach(() => {
  (fetch as jest.Mock).mockReset();
  (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
  onSaved.mockReset();
});

describe('ThrowAwayFlow', () => {
  it('prefills the amount with everything remaining — binning the lot is the common case', () => {
    render(<ThrowAwayFlow uuid="uuid-1" item={{ ...item, remaining: 300 }} onSaved={onSaved} />);
    openPanel();
    expect(screen.getByLabelText('Amount thrown away')).toHaveValue(300);
  });

  it('decrements remaining via PUT and never posts to Google Health', async () => {
    render(<ThrowAwayFlow uuid="uuid-1" item={item} onSaved={onSaved} />);
    openPanel();

    fireEvent.change(screen.getByLabelText('Amount thrown away'), { target: { value: '100' } });
    fireEvent.submit(screen.getByLabelText('Amount thrown away').closest('form')!);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/pantry/uuid-1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            name: 'Milk',
            measure: 'ml',
            amount: 500,
            remaining: 400,
            expiration: '2000-01-01',
          }),
        }),
      );
      expect(onSaved).toHaveBeenCalled();
    });
    // Thrown-away food was never eaten, so nothing may reach the food diary.
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalledWith('/api/google-health/foods/log', expect.anything());
  });

  it('clamps remaining to zero (never deletes) when more than what is left gets binned', async () => {
    render(<ThrowAwayFlow uuid="uuid-1" item={item} onSaved={onSaved} />);
    openPanel();

    fireEvent.change(screen.getByLabelText('Amount thrown away'), { target: { value: '600' } });
    fireEvent.submit(screen.getByLabelText('Amount thrown away').closest('form')!);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/pantry/uuid-1',
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"remaining":0'),
        }),
      );
    });
    expect(fetch).not.toHaveBeenCalledWith('/api/pantry/uuid-1', expect.objectContaining({ method: 'DELETE' }));
  });

  it('shows an error and keeps the panel open when the update fails', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: false });
    render(<ThrowAwayFlow uuid="uuid-1" item={item} onSaved={onSaved} />);
    openPanel();

    fireEvent.submit(screen.getByLabelText('Amount thrown away').closest('form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent(/failed to update/i);
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Amount thrown away')).toBeInTheDocument();
  });
});
