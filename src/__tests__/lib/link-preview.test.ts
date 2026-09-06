import {
  extractMetaContent,
  extractTitleTag,
  isSafePreviewUrl,
  isYoutubeUrl,
  parseWebsitePreview,
  parseYoutubeOembed,
  resolveUrl,
} from '@/lib/link-preview';

describe('isYoutubeUrl', () => {
  it.each([
    'https://www.youtube.com/watch?v=abc123',
    'https://youtube.com/watch?v=abc123',
    'https://m.youtube.com/watch?v=abc123',
    'https://youtu.be/abc123',
    'https://www.youtube-nocookie.com/embed/abc123',
  ])('recognises %s as a YouTube URL', (url) => {
    expect(isYoutubeUrl(new URL(url))).toBe(true);
  });

  it('does not treat other hosts as YouTube', () => {
    expect(isYoutubeUrl(new URL('https://www.bbcgoodfood.com/recipes/toast'))).toBe(false);
  });
});

describe('isSafePreviewUrl', () => {
  it('allows a normal https URL', () => {
    expect(isSafePreviewUrl(new URL('https://www.bbcgoodfood.com/recipes/toast'))).toBe(true);
  });

  it('rejects non-http(s) protocols', () => {
    expect(isSafePreviewUrl(new URL('file:///etc/passwd'))).toBe(false);
  });

  it('rejects localhost', () => {
    expect(isSafePreviewUrl(new URL('http://localhost:8080/secret'))).toBe(false);
  });

  it('rejects .local hostnames', () => {
    expect(isSafePreviewUrl(new URL('http://nas.local/secret'))).toBe(false);
  });

  it('rejects loopback IPv4 addresses', () => {
    expect(isSafePreviewUrl(new URL('http://127.0.0.1/secret'))).toBe(false);
  });

  it('rejects private IPv4 ranges', () => {
    expect(isSafePreviewUrl(new URL('http://10.0.0.5/secret'))).toBe(false);
    expect(isSafePreviewUrl(new URL('http://192.168.1.1/secret'))).toBe(false);
    expect(isSafePreviewUrl(new URL('http://172.16.0.1/secret'))).toBe(false);
  });

  it('rejects the cloud metadata address', () => {
    expect(isSafePreviewUrl(new URL('http://169.254.169.254/latest/meta-data'))).toBe(false);
  });

  it('rejects IPv6 loopback', () => {
    expect(isSafePreviewUrl(new URL('http://[::1]/secret'))).toBe(false);
  });
});

describe('extractMetaContent', () => {
  it('finds a property/content meta tag', () => {
    const html = '<meta property="og:site_name" content="BBC Good Food">';
    expect(extractMetaContent(html, 'og:site_name')).toBe('BBC Good Food');
  });

  it('finds a name/content meta tag', () => {
    const html = '<meta name="og:title" content="Lemon Drizzle Cake">';
    expect(extractMetaContent(html, 'og:title')).toBe('Lemon Drizzle Cake');
  });

  it('finds a meta tag with content before property', () => {
    const html = '<meta content="Some Site" property="og:site_name">';
    expect(extractMetaContent(html, 'og:site_name')).toBe('Some Site');
  });

  it('decodes HTML entities', () => {
    const html = '<meta property="og:title" content="Fish &amp; Chips">';
    expect(extractMetaContent(html, 'og:title')).toBe('Fish & Chips');
  });

  it('returns null when not found', () => {
    expect(extractMetaContent('<html></html>', 'og:title')).toBeNull();
  });
});

describe('extractTitleTag', () => {
  it('extracts the title tag contents', () => {
    expect(extractTitleTag('<title>Lemon Drizzle Cake</title>')).toBe('Lemon Drizzle Cake');
  });

  it('returns null when there is no title tag', () => {
    expect(extractTitleTag('<html></html>')).toBeNull();
  });
});

describe('resolveUrl', () => {
  it('resolves a relative URL against the page URL', () => {
    expect(resolveUrl('/images/cake.jpg', 'https://example.com/recipes/cake')).toBe(
      'https://example.com/images/cake.jpg',
    );
  });

  it('leaves an absolute URL unchanged', () => {
    expect(resolveUrl('https://cdn.example.com/cake.jpg', 'https://example.com/recipes/cake')).toBe(
      'https://cdn.example.com/cake.jpg',
    );
  });

  it('returns null for an unresolvable URL', () => {
    expect(resolveUrl('', '')).toBeNull();
  });
});

describe('parseWebsitePreview', () => {
  it('extracts og:site_name, og:title and og:image', () => {
    const html = `
      <meta property="og:site_name" content="BBC Good Food">
      <meta property="og:title" content="Lemon Drizzle Cake">
      <meta property="og:image" content="/images/cake.jpg">
    `;
    expect(parseWebsitePreview(html, 'https://www.bbcgoodfood.com/recipes/lemon-drizzle-cake')).toEqual({
      type: 'website',
      siteName: 'BBC Good Food',
      title: 'Lemon Drizzle Cake',
      image: 'https://www.bbcgoodfood.com/images/cake.jpg',
    });
  });

  it('falls back to the hostname when og:site_name is missing', () => {
    const result = parseWebsitePreview('<html></html>', 'https://www.example.com/recipe');
    expect(result).toMatchObject({ type: 'website', siteName: 'example.com' });
  });

  it('falls back to the <title> tag when og:title is missing', () => {
    const html = '<title>Fallback Title</title>';
    const result = parseWebsitePreview(html, 'https://www.example.com/recipe');
    expect(result).toMatchObject({ title: 'Fallback Title' });
  });

  it('has a null image when og:image is missing', () => {
    const result = parseWebsitePreview('<html></html>', 'https://www.example.com/recipe');
    expect(result).toMatchObject({ image: null });
  });
});

describe('parseYoutubeOembed', () => {
  it('maps oEmbed fields to a youtube preview', () => {
    expect(
      parseYoutubeOembed({
        title: 'How to make lemon drizzle cake',
        author_name: 'Some Baking Channel',
        thumbnail_url: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
      }),
    ).toEqual({
      type: 'youtube',
      title: 'How to make lemon drizzle cake',
      channelName: 'Some Baking Channel',
      thumbnailUrl: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
    });
  });

  it('defaults missing fields to null', () => {
    expect(parseYoutubeOembed({})).toEqual({
      type: 'youtube',
      title: null,
      channelName: null,
      thumbnailUrl: null,
    });
  });
});
