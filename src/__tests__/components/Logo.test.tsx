import { render } from '@testing-library/react';
import Logo from '@/components/Logo';

describe('Logo', () => {
  it('defaults to a 44px square', () => {
    const { container } = render(<Logo />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '44');
    expect(svg).toHaveAttribute('height', '44');
  });

  it('renders at the requested size', () => {
    const { container } = render(<Logo size={24} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '24');
    expect(svg).toHaveAttribute('height', '24');
  });
});
