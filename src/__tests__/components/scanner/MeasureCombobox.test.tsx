import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MeasureCombobox from '@/components/scanner/MeasureCombobox';

jest.mock('swr');
jest.mock('@/components/Metadata', () => () => null);

const useSWR = require('swr').default;
global.fetch = jest.fn();

const mockMeasures: Measure[] = [
  { measureId: 'GRAMS', singular: 'gram', plural: 'grams' },
  { measureId: 'ML', singular: 'millilitre', plural: 'millilitres' },
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

  it('filters measures as user types', () => {
    render(<MeasureCombobox value={null} onChange={jest.fn()} />);
    fireEvent.click(screen.getByText('Select measure…'));
    fireEvent.change(screen.getByPlaceholderText('Search measures…'), { target: { value: 'gram' } });
    expect(screen.getByText('gram / grams')).toBeInTheDocument();
    expect(screen.queryByText('millilitre / millilitres')).not.toBeInTheDocument();
  });

  it('calls onChange when a measure is selected', () => {
    const onChange = jest.fn();
    render(<MeasureCombobox value={null} onChange={onChange} />);
    fireEvent.click(screen.getByText('Select measure…'));
    fireEvent.click(screen.getByText('gram / grams'));
    expect(onChange).toHaveBeenCalledWith(mockMeasures[0]);
  });

  it('shows create form when "+ Create new measure" is clicked', () => {
    render(<MeasureCombobox value={null} onChange={jest.fn()} />);
    fireEvent.click(screen.getByText('Select measure…'));
    fireEvent.click(screen.getByText('+ Create new measure'));
    expect(screen.getByPlaceholderText('Singular (e.g. gram)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Plural (e.g. grams)')).toBeInTheDocument();
  });

  it('saves new measure and calls onChange with the created measure', async () => {
    const onChange = jest.fn();
    const mutate = jest.fn();
    useSWR.mockReturnValue({ data: mockMeasures, mutate });
    const created: Measure = { measureId: 'LITRES', singular: 'litre', plural: 'litres' };
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => created });

    render(<MeasureCombobox value={null} onChange={onChange} />);
    fireEvent.click(screen.getByText('Select measure…'));
    fireEvent.click(screen.getByText('+ Create new measure'));
    fireEvent.change(screen.getByPlaceholderText('Singular (e.g. gram)'), { target: { value: 'litre' } });
    fireEvent.change(screen.getByPlaceholderText('Plural (e.g. grams)'), { target: { value: 'litres' } });
    fireEvent.click(screen.getByText('Save measure'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/measures', expect.objectContaining({ method: 'POST' }));
      expect(onChange).toHaveBeenCalledWith(created);
    });
  });

  it('shows error when create fails', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: false });
    useSWR.mockReturnValue({ data: mockMeasures, mutate: jest.fn() });

    render(<MeasureCombobox value={null} onChange={jest.fn()} />);
    fireEvent.click(screen.getByText('Select measure…'));
    fireEvent.click(screen.getByText('+ Create new measure'));
    fireEvent.change(screen.getByPlaceholderText('Singular (e.g. gram)'), { target: { value: 'x' } });
    fireEvent.change(screen.getByPlaceholderText('Plural (e.g. grams)'), { target: { value: 'xs' } });
    fireEvent.click(screen.getByText('Save measure'));

    await waitFor(() => {
      expect(screen.getByText('Failed to create measure')).toBeInTheDocument();
    });
  });
});
