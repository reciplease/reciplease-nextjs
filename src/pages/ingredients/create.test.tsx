import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CreateIngredient from './create';

jest.mock('next/router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/components/Metadata', () => () => null);

global.fetch = jest.fn();

describe('CreateIngredient form', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockReset();
  });

  it('renders name input and measure select', () => {
    render(<CreateIngredient />);
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Measure')).toBeInTheDocument();
  });

  it('renders all measure options', () => {
    render(<CreateIngredient />);
    const select = screen.getByLabelText('Measure') as HTMLSelectElement;
    expect(select.options.length).toBeGreaterThan(0);
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
        expect.objectContaining({ method: 'POST' }),
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
