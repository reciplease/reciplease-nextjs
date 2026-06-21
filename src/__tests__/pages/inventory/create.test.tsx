import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CreateInventoryItem from '@/pages/inventory/create';

jest.mock('swr');
jest.mock('next/router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/components/Metadata', () => () => null);

const useSWR = require('swr').default;
global.fetch = jest.fn();

const mockMeasures: Measure[] = [
  { measureId: 'MILLILITRES', singular: 'millilitre', plural: 'millilitres', short: 'ml' },
  { measureId: 'ITEMS', singular: 'item', plural: 'items', short: 'item' },
];

describe('CreateInventoryItem form', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockReset();
  });

  it('shows loading state for measure dropdown', () => {
    useSWR.mockReturnValue({ isLoading: true, data: undefined });
    render(<CreateInventoryItem />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders an empty measure dropdown when no measures are available', () => {
    useSWR.mockReturnValue({ isLoading: false, data: undefined });
    render(<CreateInventoryItem />);
    expect(screen.getByLabelText('Measure')).toBeEmptyDOMElement();
  });

  it('renders name, measure, amount, expiration and barcode inputs', () => {
    useSWR.mockReturnValue({ isLoading: false, data: mockMeasures });
    render(<CreateInventoryItem />);
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Measure')).toBeInTheDocument();
    expect(screen.getByLabelText('Amount')).toBeInTheDocument();
    expect(screen.getByLabelText('Expiration date')).toBeInTheDocument();
    expect(screen.getByLabelText(/Barcode/)).toBeInTheDocument();
  });

  it('submits correct payload and redirects on success', async () => {
    const push = jest.fn();
    jest.spyOn(require('next/router'), 'useRouter').mockReturnValue({ push });
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
    useSWR.mockReturnValue({ isLoading: false, data: mockMeasures });

    render(<CreateInventoryItem />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Milk' } });
    fireEvent.change(screen.getByLabelText('Measure'), { target: { value: 'MILLILITRES' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText('Expiration date'), { target: { value: '2099-12-31' } });
    fireEvent.change(screen.getByLabelText(/Barcode/), { target: { value: '5012345678900' } });
    fireEvent.submit(screen.getByRole('button', { name: /add to inventory/i }).closest('form')!);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/inventory',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'Milk',
            measureId: 'MILLILITRES',
            amount: 500,
            expiration: '2099-12-31',
            barcode: '5012345678900',
          }),
        }),
      );
      expect(push).toHaveBeenCalledWith('/inventory');
    });
  });

  it('omits barcode when left blank', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
    useSWR.mockReturnValue({ isLoading: false, data: mockMeasures });

    render(<CreateInventoryItem />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Bread' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Expiration date'), { target: { value: '2099-12-31' } });
    fireEvent.submit(screen.getByRole('button', { name: /add to inventory/i }).closest('form')!);

    await waitFor(() => {
      const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
      expect(body).not.toHaveProperty('barcode');
    });
  });

  it('shows error message when submission fails', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: false });
    useSWR.mockReturnValue({ isLoading: false, data: mockMeasures });

    render(<CreateInventoryItem />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Milk' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText('Expiration date'), { target: { value: '2099-12-31' } });
    fireEvent.submit(screen.getByRole('button', { name: /add to inventory/i }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('shows error message on network failure', async () => {
    (fetch as jest.Mock).mockRejectedValue(new Error('network down'));
    useSWR.mockReturnValue({ isLoading: false, data: mockMeasures });

    render(<CreateInventoryItem />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Milk' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText('Expiration date'), { target: { value: '2099-12-31' } });
    fireEvent.submit(screen.getByRole('button', { name: /add to inventory/i }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('An unexpected error occurred.');
    });
  });
});
