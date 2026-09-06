import { render, screen } from '@testing-library/react';
import SourceLink from './SourceLink';

jest.mock('swr');

const useSWR = require('swr').default;

describe('SourceLink', () => {
  it('renders a loading placeholder while the preview is loading', () => {
    useSWR.mockReturnValue({ data: undefined, error: undefined });
    render(<SourceLink url="https://www.bbcgoodfood.com/recipes/toast" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Loading preview…')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
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
        recipeMeta: null,
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
      data: { type: 'website', siteName: 'example.com', title: null, image: null, recipeMeta: null },
      error: undefined,
    });
    render(<SourceLink url="https://www.example.com/recipe" />);
    expect(screen.getAllByText('example.com')).toHaveLength(2);
  });

  it('renders time, servings and rating when recipe metadata is available', () => {
    useSWR.mockReturnValue({
      data: {
        type: 'website',
        siteName: 'HelloFresh',
        title: 'Creamy Garden Herb Chicken',
        image: null,
        recipeMeta: { time: '35 min', servings: 'Serves 2', rating: { value: 4.4, count: 14007 } },
      },
      error: undefined,
    });
    render(<SourceLink url="https://www.hellofresh.com/recipes/creamy-garden-herb-chicken" />);
    expect(screen.getByText('35 min · Serves 2 · ★4.4 (14,007)')).toBeInTheDocument();
  });

  it('omits missing recipe metadata parts from the summary line', () => {
    useSWR.mockReturnValue({
      data: {
        type: 'website',
        siteName: 'Good Food',
        title: 'Pavlova',
        image: null,
        recipeMeta: { time: '1h 40m', servings: null, rating: null },
      },
      error: undefined,
    });
    render(<SourceLink url="https://www.bbcgoodfood.com/recipes/pavlova" />);
    expect(screen.getByText('1h 40m')).toBeInTheDocument();
  });

  it('does not render a metadata line when recipeMeta is null', () => {
    useSWR.mockReturnValue({
      data: { type: 'website', siteName: 'example.com', title: null, image: null, recipeMeta: null },
      error: undefined,
    });
    render(<SourceLink url="https://www.example.com/recipe" />);
    expect(screen.queryByText(/min|Serves|★/)).not.toBeInTheDocument();
  });
});
