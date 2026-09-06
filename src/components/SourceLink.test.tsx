import { render, screen } from '@testing-library/react';
import SourceLink from './SourceLink';

jest.mock('swr');

const useSWR = require('swr').default;

describe('SourceLink', () => {
  it('renders a plain link while loading', () => {
    useSWR.mockReturnValue({ data: undefined, error: undefined });
    render(<SourceLink url="https://www.bbcgoodfood.com/recipes/toast" />);
    const link = screen.getByRole('link', { name: /Source: https:\/\/www\.bbcgoodfood\.com/ });
    expect(link).toHaveAttribute('href', 'https://www.bbcgoodfood.com/recipes/toast');
  });

  it('renders a plain link when the preview fails to load', () => {
    useSWR.mockReturnValue({ data: undefined, error: new Error('failed') });
    render(<SourceLink url="https://www.bbcgoodfood.com/recipes/toast" />);
    expect(screen.getByRole('link', { name: /Source:/ })).toBeInTheDocument();
  });

  it('renders a YouTube preview with title and channel name', () => {
    useSWR.mockReturnValue({
      data: {
        type: 'youtube',
        title: 'How to make lemon drizzle cake',
        channelName: 'Some Baking Channel',
        thumbnailUrl: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
      },
      error: undefined,
    });
    const { container } = render(<SourceLink url="https://www.youtube.com/watch?v=abc123" />);

    expect(screen.getByText('How to make lemon drizzle cake')).toBeInTheDocument();
    expect(screen.getByText('Some Baking Channel · YouTube')).toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
    );
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://www.youtube.com/watch?v=abc123');
  });

  it('renders a generic YouTube label when the channel name is missing', () => {
    useSWR.mockReturnValue({
      data: { type: 'youtube', title: null, channelName: null, thumbnailUrl: null },
      error: undefined,
    });
    render(<SourceLink url="https://youtu.be/abc123" />);
    expect(screen.getByText('YouTube')).toBeInTheDocument();
  });

  it('renders a website preview with site name and title', () => {
    useSWR.mockReturnValue({
      data: {
        type: 'website',
        siteName: 'BBC Good Food',
        title: 'Lemon Drizzle Cake',
        image: 'https://www.bbcgoodfood.com/images/cake.jpg',
      },
      error: undefined,
    });
    const { container } = render(<SourceLink url="https://www.bbcgoodfood.com/recipes/lemon-drizzle-cake" />);

    expect(screen.getByText('Lemon Drizzle Cake')).toBeInTheDocument();
    expect(screen.getByText('BBC Good Food')).toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://www.bbcgoodfood.com/images/cake.jpg');
  });

  it('falls back to the site name as the title when no title is available', () => {
    useSWR.mockReturnValue({
      data: { type: 'website', siteName: 'example.com', title: null, image: null },
      error: undefined,
    });
    render(<SourceLink url="https://www.example.com/recipe" />);
    expect(screen.getAllByText('example.com')).toHaveLength(2);
  });
});
