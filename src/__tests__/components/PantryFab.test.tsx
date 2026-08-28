import { render, screen, fireEvent } from '@testing-library/react';
import PantryFab from '@/components/PantryFab';

jest.mock('next/link', () => ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
  <a href={href} {...rest}>{children}</a>
));
jest.mock('next-auth/react');
jest.mock('next/router', () => ({ useRouter: jest.fn() }));

const useSession = require('next-auth/react').useSession as jest.Mock;
const useRouter = require('next/router').useRouter as jest.Mock;

describe('PantryFab', () => {
  const originalAuthDisabled = process.env.NEXT_PUBLIC_AUTH_DISABLED;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_AUTH_DISABLED = 'false';
    useSession.mockReturnValue({ status: 'authenticated' });
    useRouter.mockReturnValue({ pathname: '/pantry' });
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_AUTH_DISABLED = originalAuthDisabled;
  });

  it('starts closed, showing only the toggle', () => {
    render(<PantryFab />);
    expect(screen.getByRole('button', { name: 'Add to pantry' })).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('opens to reveal the single-item and whole-shop options', () => {
    render(<PantryFab />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to pantry' }));

    expect(screen.getByRole('link', { name: 'Add one item' })).toHaveAttribute(
      'href',
      '/pantry/scan',
    );
    expect(screen.getByRole('link', { name: 'Add a whole shop' })).toHaveAttribute(
      'href',
      '/pantry/shop',
    );
  });

  it('closes again when the toggle is clicked a second time', () => {
    render(<PantryFab />);
    const toggle = screen.getByRole('button', { name: 'Add to pantry' });
    fireEvent.click(toggle);
    fireEvent.click(toggle);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('closes when Escape is pressed', () => {
    render(<PantryFab />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to pantry' }));
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders nothing when unauthenticated', () => {
    useSession.mockReturnValue({ status: 'unauthenticated' });
    const { container } = render(<PantryFab />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    '/pantry/scan',
    '/pantry/shop',
    '/pantry/shop/process',
    '/pantry/shop/process/[uuid]',
  ])('hides itself on %s', (pathname) => {
    useRouter.mockReturnValue({ pathname });
    const { container } = render(<PantryFab />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows in local dev when auth is disabled, regardless of session', () => {
    process.env.NEXT_PUBLIC_AUTH_DISABLED = 'true';
    useSession.mockReturnValue({ status: 'unauthenticated' });
    render(<PantryFab />);
    expect(screen.getByRole('button', { name: 'Add to pantry' })).toBeInTheDocument();
  });
});
