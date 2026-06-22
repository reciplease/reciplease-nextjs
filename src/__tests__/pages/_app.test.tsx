import { render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';

jest.mock('@/components/Layout', () => ({ children }: { children: React.ReactNode }) => (
  <div data-testid="layout">{children}</div>
));
jest.mock('@/components/AccessGate', () => ({ children }: { children: React.ReactNode }) => (
  <div data-testid="access-gate">{children}</div>
));
jest.mock('next/router', () => ({ useRouter: jest.fn() }));
jest.mock('next/head', () => ({ __esModule: true, default: () => null }));
jest.mock('next-auth/react', () => ({
  SessionProvider: ({
    children,
    session,
    refetchOnWindowFocus,
  }: {
    children: React.ReactNode;
    session?: unknown;
    refetchOnWindowFocus: boolean;
  }) => (
    <div
      data-testid="session-provider"
      data-session={JSON.stringify(session ?? null)}
      data-refetch={String(refetchOnWindowFocus)}
    >
      {children}
    </div>
  ),
}));

const TestComponent = () => <div>Page Content</div>;

const ORIGINAL_ENV = process.env;

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

function loadApp(envOverrides: Record<string, string | undefined> = {}) {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV, ...envOverrides };
  const useRouterMock = require('next/router').useRouter as jest.Mock;
  const App = require('@/pages/_app').default as ComponentType<{
    Component: ComponentType;
    pageProps: { session?: unknown };
  }>;
  return { App, useRouterMock };
}

describe('_app', () => {
  it('renders standalone (no Layout/AccessGate) on the login page', () => {
    const { App, useRouterMock } = loadApp();
    useRouterMock.mockReturnValue({ pathname: '/login' });

    render(<App Component={TestComponent} pageProps={{}} />);

    expect(screen.getByText('Page Content')).toBeInTheDocument();
    expect(screen.queryByTestId('layout')).not.toBeInTheDocument();
    expect(screen.queryByTestId('access-gate')).not.toBeInTheDocument();
    const provider = screen.getByTestId('session-provider');
    expect(provider).toHaveAttribute('data-session', 'null');
    expect(provider).toHaveAttribute('data-refetch', 'true');
  });

  it('renders standalone on the scanner page', () => {
    const { App, useRouterMock } = loadApp();
    useRouterMock.mockReturnValue({ pathname: '/inventory/scan' });

    render(<App Component={TestComponent} pageProps={{}} />);

    expect(screen.getByText('Page Content')).toBeInTheDocument();
    expect(screen.queryByTestId('layout')).not.toBeInTheDocument();
    expect(screen.queryByTestId('access-gate')).not.toBeInTheDocument();
  });

  it('renders standalone on the handle onboarding page (avoids redirect loop with AccessGate)', () => {
    const { App, useRouterMock } = loadApp();
    useRouterMock.mockReturnValue({ pathname: '/onboarding/handle' });

    render(<App Component={TestComponent} pageProps={{}} />);

    expect(screen.getByText('Page Content')).toBeInTheDocument();
    expect(screen.queryByTestId('layout')).not.toBeInTheDocument();
    expect(screen.queryByTestId('access-gate')).not.toBeInTheDocument();
  });

  it.each(['/recipes', '/recipes/[recipeId]', '/settings'])(
    'renders %s inside Layout without AccessGate',
    (pathname) => {
      const { App, useRouterMock } = loadApp();
      useRouterMock.mockReturnValue({ pathname });

      render(<App Component={TestComponent} pageProps={{}} />);

      expect(screen.getByTestId('layout')).toBeInTheDocument();
      expect(screen.queryByTestId('access-gate')).not.toBeInTheDocument();
      expect(screen.getByText('Page Content')).toBeInTheDocument();
    },
  );

  it('renders other pages inside Layout and AccessGate', () => {
    const { App, useRouterMock } = loadApp();
    useRouterMock.mockReturnValue({ pathname: '/inventory' });

    render(<App Component={TestComponent} pageProps={{}} />);

    expect(screen.getByTestId('layout')).toBeInTheDocument();
    expect(screen.getByTestId('access-gate')).toBeInTheDocument();
    expect(screen.getByText('Page Content')).toBeInTheDocument();
  });

  it('injects a fake session and disables refetch-on-focus when NEXT_PUBLIC_FAKE_AUTH is true', () => {
    const { App, useRouterMock } = loadApp({ NEXT_PUBLIC_FAKE_AUTH: 'true' });
    useRouterMock.mockReturnValue({ pathname: '/inventory' });

    render(<App Component={TestComponent} pageProps={{}} />);

    const provider = screen.getByTestId('session-provider');
    expect(provider).toHaveAttribute('data-refetch', 'false');
    expect(JSON.parse(provider.getAttribute('data-session')!)).toMatchObject({
      user: { handle: 'local-dev-user' },
    });
  });

  it('prefers a session passed in pageProps over the fake session', () => {
    const { App, useRouterMock } = loadApp({ NEXT_PUBLIC_FAKE_AUTH: 'true' });
    useRouterMock.mockReturnValue({ pathname: '/inventory' });
    const session = { user: { handle: 'real-handle' }, expires: '2999-12-31T23:59:59.999Z' };

    render(<App Component={TestComponent} pageProps={{ session }} />);

    const provider = screen.getByTestId('session-provider');
    expect(JSON.parse(provider.getAttribute('data-session')!)).toEqual(session);
  });
});
