import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import IngredientModal from '@/components/scanner/IngredientModal';

jest.mock('swr');
jest.mock('@/components/Metadata', () => () => null);

const useSWR = require('swr').default;
global.fetch = jest.fn();

const mockMeasures: Measure[] = [
  { measureId: 'GRAMS', singular: 'gram', plural: 'grams' },
];

const mockMatches: Ingredient[] = [
  { uuid: 'ing-1', name: 'Oat Milk', measure: { measureId: 'ML', singular: 'millilitre', plural: 'millilitres' } },
  { uuid: 'ing-2', name: 'Whole Milk', measure: { measureId: 'ML', singular: 'millilitre', plural: 'millilitres' } },
];

describe('IngredientModal', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockReset();
    useSWR.mockReturnValue({ data: mockMeasures, mutate: jest.fn() });
  });

  it('shows suggested name', () => {
    render(<IngredientModal suggestedName="Oat Milk" matches={[]} onSelect={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByText('Oat Milk')).toBeInTheDocument();
  });

  it('renders all ingredient matches', () => {
    render(<IngredientModal suggestedName="Milk" matches={mockMatches} onSelect={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByText('Oat Milk')).toBeInTheDocument();
    expect(screen.getByText('Whole Milk')).toBeInTheDocument();
  });

  it('shows no-match message when matches is empty', () => {
    render(<IngredientModal suggestedName="xyz" matches={[]} onSelect={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByText('No matching ingredients found.')).toBeInTheDocument();
  });

  it('calls onSelect when an existing ingredient is clicked', () => {
    const onSelect = jest.fn();
    render(<IngredientModal suggestedName="Milk" matches={mockMatches} onSelect={onSelect} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Oat Milk'));
    expect(onSelect).toHaveBeenCalledWith(mockMatches[0]);
  });

  it('calls onClose when cancel scan is clicked', () => {
    const onClose = jest.fn();
    render(<IngredientModal suggestedName="Milk" matches={[]} onSelect={jest.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByText('✕ Cancel scan'));
    expect(onClose).toHaveBeenCalled();
  });

  it('always shows "+ Create ingredient" button', () => {
    render(<IngredientModal suggestedName="Milk" matches={mockMatches} onSelect={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByText('+ Create ingredient')).toBeInTheDocument();
  });

  it('shows create form pre-filled with suggested name', () => {
    render(<IngredientModal suggestedName="Oat Milk" matches={[]} onSelect={jest.fn()} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('+ Create ingredient'));
    expect(screen.getByDisplayValue('Oat Milk')).toBeInTheDocument();
  });

  it('creates ingredient and calls onSelect', async () => {
    const onSelect = jest.fn();
    const created: Ingredient = { uuid: 'new-1', name: 'Oat Milk', measure: mockMeasures[0] };
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => created });

    render(<IngredientModal suggestedName="Oat Milk" matches={[]} onSelect={onSelect} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('+ Create ingredient'));
    // measure combobox opens
    fireEvent.click(screen.getByText('Select measure…'));
    fireEvent.click(screen.getByText('gram / grams'));
    fireEvent.click(screen.getByText('Save ingredient'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/ingredients', expect.objectContaining({ method: 'POST' }));
      expect(onSelect).toHaveBeenCalledWith(created);
    });
  });

  it('shows error when ingredient creation fails', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: false });

    render(<IngredientModal suggestedName="Oat Milk" matches={[]} onSelect={jest.fn()} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('+ Create ingredient'));
    fireEvent.click(screen.getByText('Select measure…'));
    fireEvent.click(screen.getByText('gram / grams'));
    fireEvent.click(screen.getByText('Save ingredient'));

    await waitFor(() => {
      expect(screen.getByText('Failed to create ingredient')).toBeInTheDocument();
    });
  });
});
