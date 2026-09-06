import { type NextRequest } from 'next/server';
import {
  isSafePreviewUrl,
  isYoutubeUrl,
  parseWebsitePreview,
  parseYoutubeOembed,
} from '@/lib/link-preview';

const USER_AGENT = 'Mozilla/5.0 (compatible; Reciplease/1.0)';
const FETCH_TIMEOUT_MS = 6000;

export async function GET(req: NextRequest): Promise<Response> {
  const rawUrl = req.nextUrl.searchParams.get('url');
  if (!rawUrl) {
    return Response.json({ error: 'url is required' }, { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return Response.json({ error: 'Invalid URL' }, { status: 400 });
  }

  if (!isSafePreviewUrl(url)) {
    return Response.json({ error: 'URL is not allowed' }, { status: 400 });
  }

  if (isYoutubeUrl(url)) {
    return fetchYoutubePreview(url);
  }

  return fetchWebsitePreview(url);
}

async function fetchYoutubePreview(url: URL): Promise<Response> {
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url.toString())}&format=json`;
  try {
    const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) {
      return Response.json({ error: 'Failed to fetch video details' }, { status: 502 });
    }
    return Response.json(parseYoutubeOembed(await res.json()));
  } catch {
    return Response.json({ error: 'Failed to fetch video details' }, { status: 502 });
  }
}

async function fetchWebsitePreview(url: URL): Promise<Response> {
  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      return Response.json({ error: 'Failed to fetch the page' }, { status: 502 });
    }
    const html = await res.text();
    return Response.json(parseWebsitePreview(html, url.toString()));
  } catch {
    return Response.json({ error: 'Failed to fetch the page' }, { status: 502 });
  }
}
