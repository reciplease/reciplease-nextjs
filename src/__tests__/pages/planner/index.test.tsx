import { render, screen } from '@testing-library/react';
import Planner from '@/pages/planner';

jest.mock('@/components/Metadata', () => () => null);

describe('Planner page', () => {
  it('shows a work in progress message', () => {
    render(<Planner />);
    expect(screen.getByRole('heading', { name: 'Planner' })).toBeInTheDocument();
    expect(screen.getByText(/Work in progress/)).toBeInTheDocument();
  });
});
