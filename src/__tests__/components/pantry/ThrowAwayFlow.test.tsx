import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ThrowAwayFlow from '@/components/pantry/ThrowAwayFlow';

// binPantryItem (src/lib/pantry.ts) calls the generated client, which calls
// this mutator directly rather than `fetch` — mocking it here keeps the
// generated request building/response envelope handling exercised for real,
// while giving the tests a single, low-level seam to assert against (same
// role `global.fetch` played before this migrated off hand-written apiFetch).
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
  expiration: '2000-01-01',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const onSaved = jest.fn();

function openPanel() {
  fireEvent.click(screen.getByRole('button', { name: 'Throw away' }));
}

beforeEach(() => {
  mockApiClientMutator.mockReset();
  mockApiClientMutator.mockResolvedValue({ data: {}, status: 200, headers: new Headers() });
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
      expect(mockApiClientMutator).toHaveBeenCalledWith(
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
    expect(mockApiClientMutator).toHaveBeenCalledTimes(1);
  });

  it('clamps remaining to zero (never deletes) when more than what is left gets binned', async () => {
    render(<ThrowAwayFlow uuid="uuid-1" item={item} onSaved={onSaved} />);
    openPanel();

    fireEvent.change(screen.getByLabelText('Amount thrown away'), { target: { value: '600' } });
    fireEvent.submit(screen.getByLabelText('Amount thrown away').closest('form')!);

    await waitFor(() => {
      expect(mockApiClientMutator).toHaveBeenCalledWith(
        '/api/pantry/uuid-1',
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"remaining":0'),
        }),
      );
    });
    expect(mockApiClientMutator).not.toHaveBeenCalledWith('/api/pantry/uuid-1', expect.objectContaining({ method: 'DELETE' }));
  });

  it('shows an error and keeps the panel open when the request rejects (network failure)', async () => {
    mockApiClientMutator.mockRejectedValue(new Error('500 Internal Server Error'));
    render(<ThrowAwayFlow uuid="uuid-1" item={item} onSaved={onSaved} />);
    openPanel();

    fireEvent.submit(screen.getByLabelText('Amount thrown away').closest('form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent(/failed to update/i);
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Amount thrown away')).toBeInTheDocument();
  });

  it('shows an error and keeps the panel open when the update resolves with a non-2xx status', async () => {
    mockApiClientMutator.mockResolvedValue({
      data: { timestamp: '', status: 500, error: 'Internal Server Error', path: '/api/pantry/uuid-1' },
      status: 500,
      headers: new Headers(),
    });
    render(<ThrowAwayFlow uuid="uuid-1" item={item} onSaved={onSaved} />);
    openPanel();

    fireEvent.submit(screen.getByLabelText('Amount thrown away').closest('form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent(/failed to update/i);
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Amount thrown away')).toBeInTheDocument();
  });
});
