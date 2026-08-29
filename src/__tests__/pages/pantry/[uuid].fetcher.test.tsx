import { render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import type { ReactNode } from 'react';
import PantryItemPage from '@/pages/pantry/[uuid]';

// Fresh SWR cache per render so one test's cached item can't leak into the next.
const renderFresh = (node: ReactNode) =>
  render(<SWRConfig value={{ provider: () => new Map() }}>{node}</SWRConfig>);

jest.mock('@/lib/houses', () => ({
  useActiveHouse: () => ({ id: 'h1', name: 'Home', role: 'OWNER' }),
}));
jest.mock('next/router', () => ({
  useRouter: () => ({ isReady: true, query: { uuid: 'uuid-1' }, replace: jest.fn() }),
}));
jest.mock('next/link', () => ({ children, href }: { children: React.ReactNode; href: string }) => (
  <a href={href}>{children}</a>
));
jest.mock('@/components/Metadata', () => () => null);
jest.mock('@/components/pantry/EatFlow', () => () => <div data-testid="eat-flow" />);

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

const ML: Measure = { measureId: 'ml', singular: 'millilitre', plural: 'millilitres', short: 'ml' };

function mockApiByUrl(itemResponse: () => Promise<unknown>) {
  mockApiClientMutator.mockImplementation((url: string) => {
    if (url === '/api/measures') return Promise.resolve({ data: [ML], status: 200, headers: new Headers() });
    return itemResponse();
  });
}

describe('PantryItemPage data fetching', () => {
  afterEach(() => mockApiClientMutator.mockReset());

  it('loads and displays the item from the API', async () => {
    mockApiByUrl(() => Promise.resolve({ data: item, status: 200, headers: new Headers() }));

    renderFresh(<PantryItemPage />);

    await waitFor(() => expect(screen.getByText('Milk')).toBeInTheDocument());
    expect(mockApiClientMutator).toHaveBeenCalledWith('/api/pantry/uuid-1', expect.objectContaining({ method: 'GET' }));
  });

  it('shows a redirecting message when the request fails', async () => {
    mockApiByUrl(() => Promise.reject(new Error('404 Not Found')));

    renderFresh(<PantryItemPage />);

    await waitFor(() => expect(screen.getByText(/no longer exists/)).toBeInTheDocument());
  });
});
