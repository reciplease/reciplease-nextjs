import { render, screen, fireEvent } from '@testing-library/react';
import NameCandidates from '@/components/scanner/NameCandidates';

describe('NameCandidates', () => {
  it('renders nothing when there are no candidates', () => {
    const { container } = render(<NameCandidates candidates={[]} value="" onSelect={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a chip per candidate and selects on tap', () => {
    const onSelect = jest.fn();
    render(<NameCandidates candidates={['Milk', 'Whole milk']} value="" onSelect={onSelect} />);

    fireEvent.click(screen.getByText('Whole milk'));

    expect(onSelect).toHaveBeenCalledWith('Whole milk');
  });

  it('marks the chip matching the current value as pressed', () => {
    render(<NameCandidates candidates={['Milk', 'Whole milk']} value="Milk" onSelect={jest.fn()} />);

    expect(screen.getByText('Milk')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Whole milk')).toHaveAttribute('aria-pressed', 'false');
  });
});
