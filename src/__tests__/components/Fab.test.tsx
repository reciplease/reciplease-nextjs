import { render, screen } from '@testing-library/react';
import RecipeFab from '@/components/RecipeFab';

jest.mock('next/link', () => ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
  <a href={href} {...rest}>{children}</a>
));
jest.mock('next-auth/react');
jest.mock('next/router', () => ({ useRouter: jest.fn() }));

const useSession = require('next-auth/react').useSession as jest.Mock;
const useRouter = require('next/router').useRouter as jest.Mock;

describe('section FABs', () => {
  const originalAuthDisabled = process.env.NEXT_PUBLIC_AUTH_DISABLED;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_AUTH_DISABLED = 'false';
    useRouter.mockReturnValue({ pathname: '/recipes' });
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_AUTH_DISABLED = originalAuthDisabled;
  });

  it('RecipeFab links to the builder when authenticated', () => {
    useSession.mockReturnValue({ status: 'authenticated' });
    render(<RecipeFab />);
    expect(screen.getByRole('link', { name: 'New recipe' })).toHaveAttribute(
      'href',
      '/recipes/new',
    );
  });

  it('renders nothing when unauthenticated', () => {
    useSession.mockReturnValue({ status: 'unauthenticated' });
    const { container } = render(<RecipeFab />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when session.error flags a dead token, even though status is authenticated', () => {
    useSession.mockReturnValue({ status: 'authenticated', data: { error: 'SessionExpired' } });
    const { container } = render(<RecipeFab />);
    expect(container).toBeEmptyDOMElement();
  });

  it('RecipeFab hides itself on the builder page', () => {
    useSession.mockReturnValue({ status: 'authenticated' });
    useRouter.mockReturnValue({ pathname: '/recipes/new' });
    const { container } = render(<RecipeFab />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows in local dev when auth is disabled, regardless of session', () => {
    process.env.NEXT_PUBLIC_AUTH_DISABLED = 'true';
    useSession.mockReturnValue({ status: 'unauthenticated' });
    render(<RecipeFab />);
    expect(screen.getByRole('link', { name: 'New recipe' })).toBeInTheDocument();
  });
});
