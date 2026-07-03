import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL, accessToken } from '@/lib/backend';

// No Google Health token refresh needed here — barcode lookup is catalog-only
// (Open Food Facts), unlike /api/food/search's history half.
export async function GET(req: NextRequest, { params }: { params: Promise<{ barcode: string }> }) {
  const token = await accessToken();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { barcode } = await params;
  const response = await fetch(`${BACKEND_URL}/api/food/barcode/${encodeURIComponent(barcode)}`, {
    method: 'GET',
    headers: { cookie: `reciplease-session=${token}` },
  });

  return new Response(response.body, { status: response.status, headers: response.headers });
}
