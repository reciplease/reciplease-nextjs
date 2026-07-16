import { render, screen, fireEvent } from '@testing-library/react';
import MeasureAmountFields from '@/components/scanner/MeasureAmountFields';

jest.mock('swr');

const useSWR = require('swr').default;
global.fetch = jest.fn();

const mockMeasures: Measure[] = [
  { measureId: 'g', singular: 'gram', plural: 'grams', short: 'g' },
  { measureId: 'ml', singular: 'millilitre', plural: 'millilitres', short: 'ml' },
];

describe('MeasureAmountFields', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockReset();
    useSWR.mockReturnValue({ data: mockMeasures, mutate: jest.fn() });
  });

  it('shows measure picker and amount input together', () => {
    render(
      <MeasureAmountFields
        idPrefix="test"
        measure={null}
        onMeasureChange={jest.fn()}
        amount=""
        onAmountChange={jest.fn()}
      />,
    );

    expect(screen.getByText('Select measure…')).toBeInTheDocument();
    expect(screen.getByLabelText(/Amount/)).toBeInTheDocument();
  });

  it('selects a measure via the combobox', () => {
    const onMeasureChange = jest.fn();
    render(
      <MeasureAmountFields
        idPrefix="test"
        measure={null}
        onMeasureChange={onMeasureChange}
        amount=""
        onAmountChange={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Select measure…'));
    fireEvent.click(screen.getByText('gram / grams'));

    expect(onMeasureChange).toHaveBeenCalledWith(mockMeasures[0]);
  });

  it("labels the amount with the chosen measure's plural and emits changes", () => {
    const onAmountChange = jest.fn();
    render(
      <MeasureAmountFields
        idPrefix="test"
        measure={mockMeasures[1]}
        onMeasureChange={jest.fn()}
        amount=""
        onAmountChange={onAmountChange}
      />,
    );

    const amount = screen.getByLabelText('Amount (millilitres)');
    fireEvent.change(amount, { target: { value: '500' } });

    expect(onAmountChange).toHaveBeenCalledWith('500');
  });
});
