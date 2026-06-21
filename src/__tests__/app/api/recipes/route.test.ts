/** @jest-environment node */
import { GET, POST } from '@/app/api/recipes/route';
import { BackendRecipe } from '@/lib/recipes';
import { shorten } from '@/lib/recipe-id';

jest.mock('@/lib/backend', () => ({ backendFetch: jest.fn() }));

const { backendFetch } = require('@/lib/backend');

const grams: Measure = { measureId: 'GRAMS', singular: 'gram', plural: 'grams', short: 'g' };
const recipeId = '5f1d8a2b3c4d5e6f70819203';

const backendRecipe: BackendRecipe = {
  recipeId,
  houseId: 'house-1',
  isPublic: true,
  name: 'Tacos',
  description: 'Tasty tacos',
  steps: ['Brown the beef'],
  ingredients: [{ name: 'Beef', measure: 'GRAMS', amount: 500 }],
};

function mockBackend(measuresResponse: unknown, recipesResponse: unknown) {
  (backendFetch as jest.Mock).mockImplementation((path: string) => {
    if (path === '/api/measures') return Promise.resolve(measuresResponse);
    return Promise.resolve(recipesResponse);
  });
}

describe('GET /api/recipes', () => {
  afterEach(() => (backendFetch as jest.Mock).mockReset());

  it('returns recipes mapped from the backend', async () => {
    mockBackend(
      { ok: true, json: async () => [grams] },
      { ok: true, json: async () => [backendRecipe] },
    );

    const response = await GET();

    expect(backendFetch).toHaveBeenCalledWith('/api/recipes');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        recipeId,
        recipeShortId: shorten(recipeId),
        houseId: 'house-1',
        isPublic: true,
        name: 'Tacos',
        description: 'Tasty tacos',
        steps: ['Brown the beef'],
        ingredients: [{ name: 'Beef', measure: grams, amount: 500 }],
        updatedAt: undefined,
      },
    ]);
  });

  it('proxies the backend error status', async () => {
    (backendFetch as jest.Mock).mockResolvedValue({ ok: false, status: 502 });

    const response = await GET();

    expect(response.status).toBe(502);
  });
});

describe('POST /api/recipes', () => {
  afterEach(() => (backendFetch as jest.Mock).mockReset());

  it('creates a recipe and returns it mapped', async () => {
    mockBackend(
      { ok: true, json: async () => [grams] },
      { ok: true, json: async () => backendRecipe },
    );

    const request = new Request('http://localhost/api/recipes', {
      method: 'POST',
      body: JSON.stringify({ name: 'Tacos', description: 'Tasty tacos', steps: ['Brown the beef'] }),
    });
    const response = await POST(request);

    expect(backendFetch).toHaveBeenCalledWith(
      '/api/recipes',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Tacos', description: 'Tasty tacos', steps: ['Brown the beef'] }),
      }),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ recipeId, name: 'Tacos' });
  });

  it('proxies the backend error status', async () => {
    (backendFetch as jest.Mock).mockResolvedValue({ ok: false, status: 400 });

    const request = new Request('http://localhost/api/recipes', {
      method: 'POST',
      body: JSON.stringify({ name: '', description: null, steps: [] }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});
