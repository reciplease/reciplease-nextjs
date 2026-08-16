import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EatFlow from '@/components/inventory/EatFlow';

jest.mock('@/lib/houses', () => ({
  apiFetch: (url: string, init?: RequestInit) => fetch(url, init),
}));

global.fetch = jest.fn();

const item: InventoryItem = {
  uuid: 'uuid-1',
  name: 'Milk',
  measure: 'ml',
  amount: 500,
  remaining: 500,
  expiration: '2099-12-31',
};

const onSaved = jest.fn();

function openPanel() {
  fireEvent.click(screen.getByRole('button', { name: 'Log eaten' }));
}

beforeEach(() => {
  (fetch as jest.Mock).mockReset();
  (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
  onSaved.mockReset();
});

describe('EatFlow', () => {
  it('decrements remaining by the typed amount', async () => {
    render(<EatFlow uuid="uuid-1" item={item} onSaved={onSaved} />);
    openPanel();

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
  });

  it('"Ate it all" pre-fills the amount with everything remaining, without submitting', () => {
    render(<EatFlow uuid="uuid-1" item={item} onSaved={onSaved} />);
    openPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Ate it all' }));

    expect(screen.getByLabelText('Amount eaten')).toHaveValue(500);
    expect(fetch).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('submits the full remaining amount after clicking "Ate it all"', async () => {
    render(<EatFlow uuid="uuid-1" item={item} onSaved={onSaved} />);
    openPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Ate it all' }));
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
  });

  it('clamps remaining to zero (never negative) when the amount eaten exceeds what is left', async () => {
    render(<EatFlow uuid="uuid-1" item={item} onSaved={onSaved} />);
    openPanel();

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
  });

  it('shows an error and keeps the panel open when the save fails', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: false });
    render(<EatFlow uuid="uuid-1" item={item} onSaved={onSaved} />);
    openPanel();

    fireEvent.change(screen.getByLabelText('Amount eaten'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to update amount. Please try again.');
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Amount eaten')).toBeInTheDocument();
  });

  it('closes the panel on a successful save', async () => {
    render(<EatFlow uuid="uuid-1" item={item} onSaved={onSaved} />);
    openPanel();
    expect(screen.getByLabelText('Amount eaten')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Amount eaten'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByLabelText('Amount eaten')).not.toBeInTheDocument());
  });
});
