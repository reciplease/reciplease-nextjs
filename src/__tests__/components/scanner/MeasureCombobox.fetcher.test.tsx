import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MeasureCombobox from '@/components/scanner/MeasureCombobox';

global.fetch = jest.fn();

const mockMeasures: Measure[] = [
  { measureId: 'g', singular: 'gram', plural: 'grams', short: 'g' },
];

describe('MeasureCombobox measures fetcher', () => {
  afterEach(() => (fetch as jest.Mock).mockReset());

  it('fetches /api/measures and lists the result once it resolves', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => mockMeasures });

    render(<MeasureCombobox value={null} onChange={jest.fn()} />);

    fireEvent.click(screen.getByText('Select measure…'));
    expect(screen.queryByText('gram / grams')).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('gram / grams')).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith('/api/measures');
  });
});
