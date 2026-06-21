import { render, screen, fireEvent } from '@testing-library/react';
import MeasureCombobox from '@/components/scanner/MeasureCombobox';

jest.mock('swr');
jest.mock('@/components/Metadata', () => () => null);

const useSWR = require('swr').default;
global.fetch = jest.fn();

const mockMeasures: Measure[] = [
  { measureId: 'g', singular: 'gram', plural: 'grams', short: 'g' },
  { measureId: 'ml', singular: 'millilitre', plural: 'millilitres', short: 'ml' },
];

describe('MeasureCombobox', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockReset();
    useSWR.mockReturnValue({ data: mockMeasures, mutate: jest.fn() });
  });

  it('shows placeholder when no value selected', () => {
    render(<MeasureCombobox value={null} onChange={jest.fn()} />);
    expect(screen.getByText('Select measure…')).toBeInTheDocument();
  });

  it('shows selected measure label', () => {
    render(<MeasureCombobox value={mockMeasures[0]} onChange={jest.fn()} />);
    expect(screen.getByText('gram / grams')).toBeInTheDocument();
  });

  it('opens dropdown on trigger click', () => {
    render(<MeasureCombobox value={null} onChange={jest.fn()} />);
    fireEvent.click(screen.getByText('Select measure…'));
    expect(screen.getByPlaceholderText('Search measures…')).toBeInTheDocument();
    expect(screen.getByText('gram / grams')).toBeInTheDocument();
    expect(screen.getByText('millilitre / millilitres')).toBeInTheDocument();
  });

  it('filters measures as user types (including by short name)', () => {
    render(<MeasureCombobox value={null} onChange={jest.fn()} />);
    fireEvent.click(screen.getByText('Select measure…'));
    fireEvent.change(screen.getByPlaceholderText('Search measures…'), { target: { value: 'ml' } });
    expect(screen.getByText('millilitre / millilitres')).toBeInTheDocument();
    expect(screen.queryByText('gram / grams')).not.toBeInTheDocument();
  });

  it('calls onChange when a measure is selected', () => {
    const onChange = jest.fn();
    render(<MeasureCombobox value={null} onChange={onChange} />);
    fireEvent.click(screen.getByText('Select measure…'));
    fireEvent.click(screen.getByText('gram / grams'));
    expect(onChange).toHaveBeenCalledWith(mockMeasures[0]);
  });

  it('does not offer a create option (measures are static)', () => {
    render(<MeasureCombobox value={null} onChange={jest.fn()} />);
    fireEvent.click(screen.getByText('Select measure…'));
    expect(screen.queryByText('+ Create new measure')).not.toBeInTheDocument();
  });

  it('closes the dropdown when clicking outside', () => {
    render(<MeasureCombobox value={null} onChange={jest.fn()} />);
    fireEvent.click(screen.getByText('Select measure…'));
    expect(screen.getByPlaceholderText('Search measures…')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByPlaceholderText('Search measures…')).not.toBeInTheDocument();
  });

  it('keeps the dropdown open when clicking inside it', () => {
    render(<MeasureCombobox value={null} onChange={jest.fn()} />);
    fireEvent.click(screen.getByText('Select measure…'));

    fireEvent.mouseDown(screen.getByPlaceholderText('Search measures…'));

    expect(screen.getByPlaceholderText('Search measures…')).toBeInTheDocument();
  });
});
