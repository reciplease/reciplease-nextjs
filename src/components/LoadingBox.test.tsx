import { render, screen } from '@testing-library/react';
import LoadingBox from './LoadingBox';

describe('LoadingBox', () => {
  it('renders a shaded, outlined box around the spinner', () => {
    const { container } = render(<LoadingBox />);
    const box = container.firstChild as HTMLElement;
    expect(box).toHaveClass('border', 'bg-zinc-100');
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('applies caller-provided sizing classes', () => {
    const { container } = render(<LoadingBox className="min-h-64" />);
    expect(container.firstChild).toHaveClass('min-h-64');
  });

  it('passes the label through to the spinner', () => {
    render(<LoadingBox label="Loading pantry…" />);
    expect(screen.getByText('Loading pantry…')).toBeInTheDocument();
  });
});
