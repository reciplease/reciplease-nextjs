import { render, screen, waitFor } from '@testing-library/react';
import AccessGate from '@/components/AccessGate';

jest.mock('next-auth/react');

const useSession = require('next-auth/react').useSession as jest.Mock;

global.fetch = jest.fn();

describe('AccessGate access probe', () => {
  afterEach(() => (fetch as jest.Mock).mockReset());

  it('probes /api/access and renders children once it resolves with 200', async () => {
    useSession.mockReturnValue({ data: { user: { email: 'cook@example.com' } }, status: 'authenticated' });
    (fetch as jest.Mock).mockResolvedValue({ status: 200 });

    render(
      <AccessGate>
        <div>App content</div>
      </AccessGate>,
    );

    expect(screen.getByText('Checking access…')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('App content')).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith('/api/access');
  });
});
