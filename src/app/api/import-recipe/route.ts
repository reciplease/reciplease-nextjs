import { type NextRequest } from 'next/server';
import { extractJsonLdBlocks, extractRecipeFromJsonLd, parseImportedRecipe } from '@/lib/import-recipe';

// Only allow fetching from known recipe sites to prevent SSRF.
const ALLOWED_HOSTNAMES = new Set([
  'www.bbcgoodfood.com',
  'bbcgoodfood.com',
  'www.hellofresh.com',
  'hellofresh.com',
  'www.hellofresh.co.uk',
  'hellofresh.co.uk',
]);

export async function POST(req: NextRequest): Promise<Response> {
  let url: string | undefined;
  try {
    ({ url } = await req.json());
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!url || typeof url !== 'string') {
    return Response.json({ error: 'url is required' }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return Response.json({ error: 'Invalid URL' }, { status: 400 });
  }

  if (!ALLOWED_HOSTNAMES.has(parsed.hostname)) {
    return Response.json(
      { error: 'Import is only supported from BBC Good Food and HelloFresh' },
      { status: 400 },
    );
  }

  let html: string;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Reciplease/1.0)' },
    });
    if (!res.ok) {
      return Response.json({ error: 'Failed to fetch the recipe page' }, { status: 502 });
    }
    html = await res.text();
  } catch {
    return Response.json({ error: 'Failed to fetch the recipe page' }, { status: 502 });
  }

  const blocks = extractJsonLdBlocks(html);
  let schema = null;
  for (const block of blocks) {
    schema = extractRecipeFromJsonLd(block);
    if (schema) break;
  }

  if (!schema) {
    return Response.json({ error: 'No recipe found on this page' }, { status: 404 });
  }

  return Response.json(parseImportedRecipe(schema));
}
