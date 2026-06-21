import { render, screen, waitFor } from '@testing-library/react';
import CreateInventoryItem from '@/pages/inventory/create';

jest.mock('next/router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/components/Metadata', () => () => null);

global.fetch = jest.fn();

describe('CreateInventoryItem data fetching', () => {
  afterEach(() => (fetch as jest.Mock).mockReset());

  it('loads measures from the API', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [{ measureId: 'ITEMS', singular: 'item', plural: 'items', short: 'item' }],
    });

    render(<CreateInventoryItem />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole('option', { name: 'items' })).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith('/api/measures');
  });
});
