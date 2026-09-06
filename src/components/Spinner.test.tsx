import { render, screen } from '@testing-library/react';
import Spinner from './Spinner';

describe('Spinner', () => {
  it('renders a status role with the default label', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
  });

  it('renders a custom label', () => {
    render(<Spinner label="Loading preview…" />);
    expect(screen.getByText('Loading preview…')).toBeInTheDocument();
  });

  it('hides the decorative hats from assistive tech', () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });
});
