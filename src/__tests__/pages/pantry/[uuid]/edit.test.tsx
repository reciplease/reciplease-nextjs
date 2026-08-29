import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditPantryItem from '@/pages/pantry/[uuid]/edit';

jest.mock('swr');
jest.mock('@/lib/houses', () => ({
  useActiveHouse: () => ({ id: 'h1', name: 'Home', role: 'OWNER' }),
}));
jest.mock('next/router', () => ({ useRouter: jest.fn() }));
jest.mock('next/link', () => ({ children, href }: { children: React.ReactNode; href: string }) => (
  <a href={href}>{children}</a>
));
jest.mock('@/components/Metadata', () => () => null);

// The generated client (src/types/generated/client.ts) calls this mutator
// directly rather than `fetch` — mocking it here keeps the generated request
// building/response envelope handling exercised for real, while giving the
// tests a single, low-level seam to assert against (same role `global.fetch`
// played before this page migrated off hand-written apiFetch calls).
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

const useSWR = require('swr').default as jest.Mock;
const useRouter = require('next/router').useRouter as jest.Mock;

// The generated hooks pass their key to `swr` as a thunk
// (`() => isEnabled ? [...] : null`), not a plain key — resolve it the same
// way the real `swr` package would before matching on it.
function resolveKey(key: unknown): unknown {
  return typeof key === 'function' ? (key as () => unknown)() : key;
}

const grams: Measure = { measureId: 'GRAMS', singular: 'gram', plural: 'grams', short: 'g' };
const items: Measure = { measureId: 'ITEMS', singular: 'item', plural: 'items', short: 'item' };

const uuid = 'b465af6e-2465-4436-84c1-14f35db68dbf';

const item: PantryItem = {
  uuid,
  name: 'Bread',
  brand: 'Warburtons',
  measure: items.measureId ?? 'ITEMS',
  amount: 1,
  remaining: 1,
  expiration: '2099-12-31',
  barcode: '0123456789012',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

function isMeasuresKey(key: unknown): boolean {
  const resolved = resolveKey(key);
  return Array.isArray(resolved) ? resolved[0] === '/api/measures' : resolved === '/api/measures';
}

function mockItemSWR(result: { isLoading: boolean; data: PantryItem | undefined; error: Error | undefined }) {
  useSWR.mockImplementation((key: unknown) => {
    if (isMeasuresKey(key)) return { data: { data: [grams, items], status: 200, headers: new Headers() }, isLoading: false };
    const itemResponse = result.data ? { data: result.data, status: 200, headers: new Headers() } : undefined;
    return { ...result, data: itemResponse };
  });
}

describe('EditPantryItem page', () => {
  const push = jest.fn();
  const replace = jest.fn();

  beforeEach(() => {
    mockApiClientMutator.mockReset();
    push.mockReset();
    replace.mockReset();
    useRouter.mockReturnValue({ push, replace, isReady: true, query: { uuid } });
  });

  it('shows loading state', () => {
    mockItemSWR({ isLoading: true, data: undefined, error: undefined });
    render(<EditPantryItem />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('redirects to the pantry list when the item fails to load', () => {
    mockItemSWR({ isLoading: false, data: undefined, error: new Error('nope') });
    render(<EditPantryItem />);
    expect(screen.getByText(/no longer exists/)).toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith('/pantry');
  });

  it('pre-populates the form from the existing item', () => {
    mockItemSWR({ isLoading: false, data: item, error: undefined });
    render(<EditPantryItem />);
    expect(screen.getByLabelText('Name')).toHaveValue('Bread');
    expect(screen.getByLabelText(/Brand/)).toHaveValue('Warburtons');
    expect(screen.getByLabelText('Amount')).toHaveValue(1);
    expect(screen.getByLabelText('Day')).toHaveValue('31');
    expect(screen.getByLabelText('Month')).toHaveValue('12');
    expect(screen.getByLabelText('Year')).toHaveValue('2099');
    expect(screen.getByLabelText(/Barcode/)).toHaveValue('0123456789012');
  });

  it('submits a PUT with the updated fields and redirects to the detail page', async () => {
    mockItemSWR({ isLoading: false, data: item, error: undefined });
    mockApiClientMutator.mockResolvedValue({ data: {}, status: 200, headers: new Headers() });

    render(<EditPantryItem />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Sourdough' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '2' } });
    fireEvent.submit(screen.getByRole('button', { name: /save changes/i }).closest('form')!);

    await waitFor(() => {
      expect(mockApiClientMutator).toHaveBeenCalledWith(
        `/api/pantry/${uuid}`,
        expect.objectContaining({ method: 'PUT' }),
      );
      expect(push).toHaveBeenCalledWith(`/pantry/${uuid}`);
    });
    const [, options] = mockApiClientMutator.mock.calls.find(([url]) => url === `/api/pantry/${uuid}`)!;
    expect(JSON.parse(options.body)).toEqual({
      name: 'Sourdough',
      measure: 'ITEMS',
      amount: 2,
      remaining: 1,
      expiration: '2099-12-31',
      brand: 'Warburtons',
      barcode: '0123456789012',
    });
  });

  it('shows an error message when the save fails', async () => {
    mockItemSWR({ isLoading: false, data: item, error: undefined });
    mockApiClientMutator.mockRejectedValue(new Error('400 Bad Request'));

    render(<EditPantryItem />);
    fireEvent.submit(screen.getByRole('button', { name: /save changes/i }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to save changes. Please try again.');
    });
  });

  describe('delete', () => {
    let confirmSpy: jest.SpyInstance;

    beforeEach(() => {
      confirmSpy = jest.spyOn(window, 'confirm');
    });

    afterEach(() => {
      confirmSpy.mockRestore();
    });

    it('does nothing if the confirmation is declined', () => {
      confirmSpy.mockReturnValue(false);
      mockItemSWR({ isLoading: false, data: item, error: undefined });

      render(<EditPantryItem />);
      fireEvent.click(screen.getByRole('button', { name: /delete item/i }));

      expect(mockApiClientMutator).not.toHaveBeenCalled();
    });

    it('deletes the item and redirects to the pantry list when confirmed', async () => {
      confirmSpy.mockReturnValue(true);
      mockItemSWR({ isLoading: false, data: item, error: undefined });
      mockApiClientMutator.mockResolvedValue({ data: undefined, status: 204, headers: new Headers() });

      render(<EditPantryItem />);
      fireEvent.click(screen.getByRole('button', { name: /delete item/i }));

      await waitFor(() => {
        expect(mockApiClientMutator).toHaveBeenCalledWith(
          `/api/pantry/${uuid}`,
          expect.objectContaining({ method: 'DELETE' }),
        );
        expect(push).toHaveBeenCalledWith('/pantry');
      });
    });

    it('shows an error message when the delete fails', async () => {
      confirmSpy.mockReturnValue(true);
      mockItemSWR({ isLoading: false, data: item, error: undefined });
      mockApiClientMutator.mockRejectedValue(new Error('500 Internal Server Error'));

      render(<EditPantryItem />);
      fireEvent.click(screen.getByRole('button', { name: /delete item/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Failed to delete item. Please try again.');
      });
    });
  });
});
