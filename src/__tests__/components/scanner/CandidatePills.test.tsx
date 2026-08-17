import { render, screen, fireEvent } from '@testing-library/react';
import CandidatePills from '@/components/scanner/CandidatePills';

describe('CandidatePills', () => {
  it('renders nothing when there are no candidates', () => {
    const { container } = render(<CandidatePills candidates={[]} value="" onSelect={jest.fn()} label="tap one" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a chip per candidate and selects on tap', () => {
    const onSelect = jest.fn();
    render(<CandidatePills candidates={['Milk', 'Whole milk']} value="" onSelect={onSelect} label="tap one" />);

    fireEvent.click(screen.getByText('Whole milk'));

    expect(onSelect).toHaveBeenCalledWith('Whole milk');
  });

  it('marks the chip matching the current value as pressed', () => {
    render(<CandidatePills candidates={['Milk', 'Whole milk']} value="Milk" onSelect={jest.fn()} label="tap one" />);

    expect(screen.getByText('Milk')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Whole milk')).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders the given label', () => {
    render(<CandidatePills candidates={['Heinz']} value="" onSelect={jest.fn()} label="tap a brand to use it" />);

    expect(screen.getByText('tap a brand to use it')).toBeInTheDocument();
  });
});
