import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CreateInventoryItem from './create';

jest.mock('swr');
jest.mock('next/router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/components/Metadata', () => () => null);

const useSWR = require('swr').default;
global.fetch = jest.fn();

const mockIngredients: Ingredient[] = [
  {
    uuid: 'ing-1',
    name: 'Milk',
    measure: { measureId: 'MILLILITRES', singular: 'millilitre', plural: 'millilitres' },
  },
  {
    uuid: 'ing-2',
    name: 'Bread',
    measure: { measureId: 'ITEMS', singular: 'item', plural: 'items' },
  },
];

describe('CreateInventoryItem form', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockReset();
  });

  it('shows loading state for ingredient dropdown', () => {
    useSWR.mockReturnValue({ isLoading: true, data: undefined });
    render(<CreateInventoryItem />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders ingredient options once loaded', () => {
    useSWR.mockReturnValue({ isLoading: false, data: mockIngredients });
    render(<CreateInventoryItem />);
    expect(screen.getByText('Milk')).toBeInTheDocument();
    expect(screen.getByText('Bread')).toBeInTheDocument();
  });

  it('renders amount and expiration inputs', () => {
    useSWR.mockReturnValue({ isLoading: false, data: mockIngredients });
    render(<CreateInventoryItem />);
    expect(screen.getByLabelText('Amount')).toBeInTheDocument();
    expect(screen.getByLabelText('Expiration date')).toBeInTheDocument();
  });

  it('submits correct payload and redirects on success', async () => {
    const push = jest.fn();
    jest.spyOn(require('next/router'), 'useRouter').mockReturnValue({ push });
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
    useSWR.mockReturnValue({ isLoading: false, data: mockIngredients });

    render(<CreateInventoryItem />);
    fireEvent.change(screen.getByLabelText('Ingredient'), { target: { value: 'ing-1' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText('Expiration date'), { target: { value: '2099-12-31' } });
    fireEvent.submit(screen.getByRole('button', { name: /add to inventory/i }).closest('form')!);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/inventory',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ ingredientUuid: 'ing-1', amount: 500, expiration: '2099-12-31' }),
        }),
      );
      expect(push).toHaveBeenCalledWith('/inventory');
    });
  });

  it('shows error message when submission fails', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: false });
    useSWR.mockReturnValue({ isLoading: false, data: mockIngredients });

    render(<CreateInventoryItem />);
    fireEvent.change(screen.getByLabelText('Ingredient'), { target: { value: 'ing-1' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText('Expiration date'), { target: { value: '2099-12-31' } });
    fireEvent.submit(screen.getByRole('button', { name: /add to inventory/i }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
