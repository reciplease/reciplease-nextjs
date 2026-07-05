/** @jest-environment node */
import { GET } from '@/app/api/manifest/route';

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('GET /api/manifest', () => {
  it('returns the manifest with the configured app version', async () => {
    process.env.NEXT_PUBLIC_APP_VERSION = '1.2.3';

    const response = await GET();

    expect(response.headers.get('Content-Type')).toBe('application/manifest+json');
    expect(await response.json()).toMatchObject({
      short_name: 'Reciplease',
      name: 'Reciplease',
      version: '1.2.3',
      start_url: '/',
      display: 'standalone',
      theme_color: '#000000',
    });
  });

  it('defaults the version to "dev" when not configured', async () => {
    delete process.env.NEXT_PUBLIC_APP_VERSION;

    const response = await GET();

    expect((await response.json()).version).toBe('dev');
  });
});
