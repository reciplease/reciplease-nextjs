export type LinkPreview =
  | { type: 'youtube'; title: string | null; channelName: string | null; thumbnailUrl: string | null }
  | { type: 'website'; title: string | null; siteName: string; image: string | null };

const YOUTUBE_HOSTNAMES = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'youtu.be',
]);

export function isYoutubeUrl(url: URL): boolean {
  return YOUTUBE_HOSTNAMES.has(url.hostname.toLowerCase());
}

function isPrivateIpv4(hostname: string): boolean {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const [a, b] = [Number(match[1]), Number(match[2])];
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isPrivateIpv6(hostname: string): boolean {
  const normalised = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return (
    normalised === '::1' ||
    normalised === '::' ||
    normalised.startsWith('fc') ||
    normalised.startsWith('fd') ||
    normalised.startsWith('fe80')
  );
}

export function isSafePreviewUrl(url: URL): boolean {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    return false;
  }
  if (isPrivateIpv4(hostname) || isPrivateIpv6(hostname)) return false;
  return true;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&apos;/g, "'");
}

export function extractMetaContent(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const forward = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["']`,
    'i',
  );
  const forwardMatch = html.match(forward);
  if (forwardMatch) return decodeHtmlEntities(forwardMatch[1]);

  const reversed = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["']`,
    'i',
  );
  const reversedMatch = html.match(reversed);
  return reversedMatch ? decodeHtmlEntities(reversedMatch[1]) : null;
}

export function extractTitleTag(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtmlEntities(match[1].trim()) || null : null;
}

export function resolveUrl(maybeRelative: string, base: string): string | null {
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return null;
  }
}

export function parseWebsitePreview(html: string, pageUrl: string): LinkPreview {
  const hostname = new URL(pageUrl).hostname.replace(/^www\./, '');
  const siteName = extractMetaContent(html, 'og:site_name') ?? hostname;
  const title = extractMetaContent(html, 'og:title') ?? extractTitleTag(html);
  const rawImage = extractMetaContent(html, 'og:image');
  const image = rawImage ? resolveUrl(rawImage, pageUrl) : null;
  return { type: 'website', title, siteName, image };
}

export type YoutubeOembedResponse = {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
};

export function parseYoutubeOembed(json: YoutubeOembedResponse): LinkPreview {
  return {
    type: 'youtube',
    title: json.title ?? null,
    channelName: json.author_name ?? null,
    thumbnailUrl: json.thumbnail_url ?? null,
  };
}
