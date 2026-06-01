import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CreateIngredient from '@/pages/ingredients/create';

jest.mock('swr');
jest.mock('next/router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/components/Metadata', () => () => null);

const useSWR = require('swr').default;
global.fetch = jest.fn();

const mockMeasures: Measure[] = [
  { measureId: 'ITEMS', singular: 'item', plural: 'items' },
  { measureId: 'GRAMS', singular: 'gram', plural: 'grams' },
];

describe('CreateIngredient form', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockReset();
    useSWR.mockReturnValue({ data: mockMeasures });
  });

  it('renders name input and measure select', () => {
    render(<CreateIngredient />);
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Measure')).toBeInTheDocument();
  });

  it('renders a measure option for each backend measure', () => {
    render(<CreateIngredient />);
    const select = screen.getByLabelText('Measure') as HTMLSelectElement;
    expect(select.options.length).toBe(mockMeasures.length);
    expect(screen.getByText('items')).toBeInTheDocument();
    expect(screen.getByText('grams')).toBeInTheDocument();
  });

  it('submits correct payload and redirects on success', async () => {
    const push = jest.fn();
    jest.spyOn(require('next/router'), 'useRouter').mockReturnValue({ push });
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });

    render(<CreateIngredient />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Milk' } });
    fireEvent.submit(screen.getByRole('button', { name: /save ingredient/i }).closest('form')!);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/ingredients',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Milk', measureId: 'ITEMS' }),
        }),
      );
      expect(push).toHaveBeenCalledWith('/inventory');
    });
  });

  it('shows error message when submission fails', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: false });

    render(<CreateIngredient />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Milk' } });
    fireEvent.submit(screen.getByRole('button', { name: /save ingredient/i }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
