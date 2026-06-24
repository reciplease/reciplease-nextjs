import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OnboardingHandle from '@/pages/onboarding/handle';

jest.mock('next-auth/react');
jest.mock('next/router', () => ({ useRouter: jest.fn() }));

const useSession = require('next-auth/react').useSession as jest.Mock;
const useRouter = require('next/router').useRouter as jest.Mock;

global.fetch = jest.fn();

jest.mock('@/lib/navigate', () => ({ hardNavigate: jest.fn() }));
const { hardNavigate } = require('@/lib/navigate') as { hardNavigate: jest.Mock };

describe('OnboardingHandle', () => {
  const replace = jest.fn();

  beforeEach(() => {
    useRouter.mockReturnValue({ replace });
    useSession.mockReturnValue({ data: { accessToken: 'rcpls-jwt' } });
    replace.mockClear();
    hardNavigate.mockClear();
    (fetch as jest.Mock).mockReset();
  });

  it('submits the handle and reloads to /recipes on success', async () => {
    (fetch as jest.Mock).mockResolvedValue({ status: 200, ok: true });

    render(<OnboardingHandle />);
    fireEvent.change(screen.getByLabelText('Handle'), { target: { value: 'chef🍳' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save handle' }));

    await waitFor(() => expect(hardNavigate).toHaveBeenCalledWith('/recipes'));
    expect(fetch).toHaveBeenCalledWith('/api/me/handle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: 'chef🍳' }),
    });
  });

  it('shows an inline error and does not navigate away on a 409 conflict', async () => {
    (fetch as jest.Mock).mockResolvedValue({ status: 409, ok: false });

    render(<OnboardingHandle />);
    fireEvent.change(screen.getByLabelText('Handle'), { target: { value: 'taken' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save handle' }));

    expect(await screen.findByText('That handle is already taken.')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('shows a generic error on other failures', async () => {
    (fetch as jest.Mock).mockResolvedValue({ status: 500, ok: false });

    render(<OnboardingHandle />);
    fireEvent.change(screen.getByLabelText('Handle'), { target: { value: 'whatever' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save handle' }));

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('does not submit an empty/whitespace-only handle', () => {
    render(<OnboardingHandle />);

    expect(screen.getByRole('button', { name: 'Save handle' })).toBeDisabled();
  });
});
