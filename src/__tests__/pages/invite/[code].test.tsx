import { render, screen } from '@testing-library/react';
import InvitePage, { getServerSideProps } from '@/pages/invite/[code]';
import { GetServerSidePropsContext } from 'next';

jest.mock('swr');
jest.mock('next-auth/react');
jest.mock('next/router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/lib/backend-url', () => ({ BACKEND_URL: 'http://localhost:8080' }));
jest.mock('@/components/Metadata', () => ({ title, description }: { title: string; description: string }) => (
  <>
    <title>{title}</title>
    <meta name="description" content={description} />
  </>
));

const useSWR = require('swr').default;
const { useSession } = require('next-auth/react');

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
  it('renders the house name immediately using the server-fetched preview', () => {
    useSession.mockReturnValue({ status: 'unauthenticated' });
    useSWR.mockReturnValue({
      data: { houseId: 'house-1', houseName: 'Test House' },
      error: undefined,
      isLoading: false,
    });

    render(<InvitePage code="abc123" initialPreview={{ houseId: 'house-1', houseName: 'Test House' }} />);

    expect(screen.getAllByText("You're invited to Test House").length).toBeGreaterThan(0);
  });
});
