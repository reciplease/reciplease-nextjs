import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EatFlow from '@/components/pantry/EatFlow';

// The generated client (src/types/generated/client.ts) calls this mutator
// directly rather than `fetch` — mocking it here keeps the generated request
// building/response envelope handling exercised for real, while giving the
// tests a single, low-level seam to assert against (same role `global.fetch`
// played before this component migrated off hand-written apiFetch calls).
const mockApiClientMutator = jest.fn();
jest.mock('@/lib/apiClientMutator', () => ({
  apiClientMutator: (...args: unknown[]) => mockApiClientMutator(...args),
  isSuccessResponse: (response: { status: number }) => response.status >= 200 && response.status < 300,
  describeErrorStatus: (status: number) => {
    if (status === 401) return 'Please sign in again.';
    if (status === 403) return "You don't have permission to do that.";
    if (status === 404) return "That couldn't be found.";
    if (status >= 400 && status < 500) return 'Please check your input and try again.';
    return 'Something went wrong. Please try again.';
  },
}));

const item: PantryItem = {
  uuid: 'uuid-1',
  name: 'Milk',
  measure: 'ml',
  amount: 500,
  remaining: 500,
  expiration: '2099-12-31',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const onSaved = jest.fn();

function openPanel() {
  fireEvent.click(screen.getByRole('button', { name: 'Log eaten' }));
}

beforeEach(() => {
  mockApiClientMutator.mockReset();
  mockApiClientMutator.mockResolvedValue({ data: {}, status: 200, headers: new Headers() });
  onSaved.mockReset();
});

describe('EatFlow', () => {
  it('decrements remaining by the typed amount', async () => {
    render(<EatFlow uuid="uuid-1" item={item} onSaved={onSaved} />);
    openPanel();

    fireEvent.change(screen.getByLabelText('Amount eaten'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockApiClientMutator).toHaveBeenCalledWith(
        '/api/pantry/uuid-1',
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
    expect(mockApiClientMutator).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('submits the full remaining amount after clicking "Ate it all"', async () => {
    render(<EatFlow uuid="uuid-1" item={item} onSaved={onSaved} />);
    openPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Ate it all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockApiClientMutator).toHaveBeenCalledWith(
        '/api/pantry/uuid-1',
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
      expect(mockApiClientMutator).toHaveBeenCalledWith(
        '/api/pantry/uuid-1',
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

  it('shows an error and keeps the panel open when the request rejects (network failure)', async () => {
    mockApiClientMutator.mockRejectedValue(new Error('500 Internal Server Error'));
    render(<EatFlow uuid="uuid-1" item={item} onSaved={onSaved} />);
    openPanel();

    fireEvent.change(screen.getByLabelText('Amount eaten'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to update amount. Please try again.');
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Amount eaten')).toBeInTheDocument();
  });

  it('shows an error and keeps the panel open when the update resolves with a non-2xx status', async () => {
    mockApiClientMutator.mockResolvedValue({
      data: { timestamp: '', status: 500, error: 'Internal Server Error', path: '/api/pantry/uuid-1' },
      status: 500,
      headers: new Headers(),
    });
    render(<EatFlow uuid="uuid-1" item={item} onSaved={onSaved} />);
    openPanel();

    fireEvent.change(screen.getByLabelText('Amount eaten'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
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
