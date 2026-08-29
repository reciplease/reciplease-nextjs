import { render, screen, waitFor } from '@testing-library/react';
import PantryList from '@/pages/pantry';

jest.mock('@/lib/houses', () => ({
  useActiveHouse: () => ({ id: 'h1', name: 'Home', role: 'OWNER' }),
  usePendingCapturedItemsCount: () => 0,
}));
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

describe('PantryList data fetching', () => {
  afterEach(() => mockApiClientMutator.mockReset());

  it('loads pantry items from the API', async () => {
    mockApiClientMutator.mockImplementation((url: string) =>
      url === '/api/measures'
        ? Promise.resolve({ data: [], status: 200, headers: new Headers() })
        : Promise.resolve({
            data: [
              {
                uuid: 'uuid-1',
                name: 'Bread',
                measure: 'ITEMS',
                amount: 2,
                expiration: '2099-12-31',
              },
            ],
            status: 200,
            headers: new Headers(),
          }),
    );

    render(<PantryList />);

    await waitFor(() => expect(screen.getByText('Bread')).toBeInTheDocument());
    expect(mockApiClientMutator).toHaveBeenCalledWith('/api/pantry', expect.objectContaining({ method: 'GET' }));
  });
});
