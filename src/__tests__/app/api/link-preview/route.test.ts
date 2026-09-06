/** @jest-environment node */
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/link-preview/route';

global.fetch = jest.fn();

function mockJson(body: unknown, status = 200) {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

function mockHtml(html: string, status = 200) {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    text: async () => html,
  });
}

function mockNetworkError() {
  (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network failure'));
}

beforeEach(() => (fetch as jest.Mock).mockReset());

function get(url: string) {
  return GET(new NextRequest(`http://localhost/api/link-preview?url=${encodeURIComponent(url)}`));
}

describe('GET /api/link-preview', () => {
  describe('validation', () => {
    it('returns 400 when the url param is missing', async () => {
      const res = await GET(new NextRequest('http://localhost/api/link-preview'));
      expect(res.status).toBe(400);
    });

    it('returns 400 for an invalid URL string', async () => {
      const res = await get('not-a-url');
      expect(res.status).toBe(400);
    });

    it('returns 400 for a localhost URL', async () => {
      const res = await get('http://localhost:8080/secret');
      expect(res.status).toBe(400);
    });

    it('returns 400 for a private IP URL', async () => {
      const res = await get('http://192.168.1.1/secret');
      expect(res.status).toBe(400);
    });
  });

  describe('YouTube sources', () => {
    it('returns video title, channel name and thumbnail from oEmbed', async () => {
      mockJson({
        title: 'How to make lemon drizzle cake',
        author_name: 'Some Baking Channel',
        thumbnail_url: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
      });
      const res = await get('https://www.youtube.com/watch?v=abc123');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        type: 'youtube',
        title: 'How to make lemon drizzle cake',
        channelName: 'Some Baking Channel',
        thumbnailUrl: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
      });
    });

    it('calls the YouTube oEmbed endpoint with the video URL', async () => {
      mockJson({ title: 'A video' });
      await get('https://youtu.be/abc123');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://www.youtube.com/oembed?url='),
        expect.anything(),
      );
    });

    it('returns 502 when the oEmbed request fails', async () => {
      mockJson({}, 404);
      const res = await get('https://www.youtube.com/watch?v=deleted');
      expect(res.status).toBe(502);
    });

    it('returns 502 when the oEmbed request throws', async () => {
      mockNetworkError();
      const res = await get('https://www.youtube.com/watch?v=abc123');
      expect(res.status).toBe(502);
    });
  });

  describe('website sources', () => {
    it('returns site name, title and image extracted from meta tags', async () => {
      mockHtml(`
        <meta property="og:site_name" content="BBC Good Food">
        <meta property="og:title" content="Lemon Drizzle Cake">
        <meta property="og:image" content="/images/cake.jpg">
      `);
      const res = await get('https://www.bbcgoodfood.com/recipes/lemon-drizzle-cake');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        type: 'website',
        siteName: 'BBC Good Food',
        title: 'Lemon Drizzle Cake',
        image: 'https://www.bbcgoodfood.com/images/cake.jpg',
        recipeMeta: null,
      });
    });

    it('falls back to the hostname as site name when no og:site_name is present', async () => {
      mockHtml('<html></html>');
      const res = await get('https://www.example.com/recipe');
      const body = await res.json();
      expect(body).toMatchObject({ type: 'website', siteName: 'example.com' });
    });

    it('returns 502 when the upstream page returns a non-OK status', async () => {
      mockHtml('', 404);
      const res = await get('https://www.example.com/gone');
      expect(res.status).toBe(502);
    });

    it('returns 502 when the upstream fetch throws (network error)', async () => {
      mockNetworkError();
      const res = await get('https://www.example.com/timeout');
      expect(res.status).toBe(502);
    });

    it('enriches the preview with time, servings and rating from schema.org Recipe JSON-LD', async () => {
      mockHtml(`
        <meta property="og:site_name" content="HelloFresh">
        <script type="application/ld+json">${JSON.stringify({
          '@type': 'Recipe',
          name: 'Creamy Garden Herb Chicken',
          totalTime: 'PT35M',
          recipeYield: 2,
          aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.411', ratingCount: '14007' },
        })}</script>
      `);
      const res = await get('https://www.hellofresh.com/recipes/creamy-garden-herb-chicken');
      const body = await res.json();
      expect(body.recipeMeta).toEqual({ time: '35 min', servings: 'Serves 2', rating: { value: 4.4, count: 14007 } });
    });
  });
});
