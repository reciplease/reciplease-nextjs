import { NextResponse } from 'next/server';

export async function GET() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev';
  return NextResponse.json(
    {
      short_name: 'Reciplease',
      name: 'Reciplease',
      version,
      icons: [
        { src: 'favicon.ico', sizes: '64x64 32x32 24x24 16x16', type: 'image/x-icon' },
        { src: 'logo192.png', type: 'image/png', sizes: '192x192' },
        { src: 'logo512.png', type: 'image/png', sizes: '512x512' },
      ],
      start_url: '/',
      display: 'standalone',
      theme_color: '#383e56',
      background_color: '#ffffff',
    },
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
}
