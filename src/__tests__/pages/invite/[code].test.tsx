import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InvitePage, { getServerSideProps } from '@/pages/invite/[code]';
import { GetServerSidePropsContext } from 'next';

jest.mock('swr');
jest.mock('next-auth/react');
jest.mock('next/router', () => ({ useRouter: jest.fn() }));
jest.mock('next/link', () => ({ children, href }: { children: React.ReactNode; href: string }) => (
  <a href={href}>{children}</a>
));
jest.mock('@/lib/backend-url', () => ({ BACKEND_URL: 'http://localhost:8080' }));
jest.mock('@/components/Metadata', () => ({ title, description }: { title: string; description: string }) => (
  <>
    <title>{title}</title>
    <meta name="description" content={description} />
  </>
));

const useSWR = require('swr').default;
const { useSession } = require('next-auth/react');
const useRouter = require('next/router').useRouter as jest.Mock;

describe('getServerSideProps', () => {
  afterEach(() => jest.restoreAllMocks());

  it('fetches the invite preview server-side so crawlers see the real house name', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ houseId: 'house-1', houseName: 'Test House' }),
    });

    const result = await getServerSideProps({ params: { code: 'abc123' } } as unknown as GetServerSidePropsContext);

    expect(result).toEqual({
      props: { code: 'abc123', initialPreview: { houseId: 'house-1', houseName: 'Test House' } },
    });
  });

  it('returns a null preview when the backend reports the invite is invalid', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });

    const result = await getServerSideProps({ params: { code: 'bad-code' } } as unknown as GetServerSidePropsContext);

    expect(result).toEqual({ props: { code: 'bad-code', initialPreview: null } });
  });

  it('returns a null preview when the backend fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network error'));

    const result = await getServerSideProps({ params: { code: 'abc123' } } as unknown as GetServerSidePropsContext);

    expect(result).toEqual({ props: { code: 'abc123', initialPreview: null } });
  });
});

describe('InvitePage', () => {
  const preview = { houseId: 'house-1', houseName: 'Test House' };

  function mockPreview() {
    useSWR.mockReturnValue({ data: preview, error: undefined, isLoading: false });
  }

  beforeEach(() => {
    useRouter.mockReturnValue({ push: jest.fn(), query: {} });
  });

  it('renders the house name immediately using the server-fetched preview', () => {
    useSession.mockReturnValue({ status: 'unauthenticated' });
    mockPreview();

    render(<InvitePage code="abc123" initialPreview={preview} />);

    expect(screen.getAllByText("You're invited to Test House").length).toBeGreaterThan(0);
  });

  it('offers a generic sign-in link that carries autoaccept back through login', () => {
    useSession.mockReturnValue({ status: 'unauthenticated' });
    mockPreview();

    render(<InvitePage code="abc123" initialPreview={preview} />);

    const link = screen.getByRole('link', { name: /sign in/i });
    expect(link).toHaveAttribute(
      'href',
      '/login?callbackUrl=%2Finvite%2Fabc123%3Fautoaccept%3Dtrue',
    );
    expect(screen.queryByText(/google/i)).not.toBeInTheDocument();
  });

  it('requires an explicit accept when already signed in (no auto-accept)', async () => {
    useSession.mockReturnValue({ status: 'authenticated' });
    mockPreview();
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    render(<InvitePage code="abc123" initialPreview={preview} />);

    // Nothing is posted until the user clicks Accept.
    expect(fetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /accept invite/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/invites/abc123/accept', { method: 'POST' }),
    );
  });

  it('auto-accepts when returning from sign-in with autoaccept=true', async () => {
    useRouter.mockReturnValue({ push: jest.fn(), query: { autoaccept: 'true' } });
    useSession.mockReturnValue({ status: 'authenticated' });
    mockPreview();
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    render(<InvitePage code="abc123" initialPreview={preview} />);

    // No button — it accepts on its own.
    expect(screen.queryByRole('button', { name: /accept invite/i })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/invites/abc123/accept', { method: 'POST' }),
    );
  });
});
