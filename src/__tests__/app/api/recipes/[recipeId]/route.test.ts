/** @jest-environment node */
import { GET, PUT } from '@/app/api/recipes/[recipeId]/route';
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

function mockBackend(measuresResponse: unknown, recipeResponse: unknown) {
  (backendFetch as jest.Mock).mockImplementation((path: string) => {
    if (path === '/api/measures') return Promise.resolve(measuresResponse);
    return Promise.resolve(recipeResponse);
  });
}

describe('GET /api/recipes/[recipeId]', () => {
  afterEach(() => (backendFetch as jest.Mock).mockReset());

  it('returns the recipe mapped from the backend', async () => {
    mockBackend(
      { ok: true, json: async () => [grams] },
      { ok: true, status: 200, json: async () => backendRecipe },
    );

    const response = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ recipeId }),
    });

    expect(backendFetch).toHaveBeenCalledWith(`/api/recipes/${recipeId}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      recipeId,
      recipeShortId: shorten(recipeId),
      houseId: 'house-1',
      isPublic: true,
      name: 'Tacos',
      description: 'Tasty tacos',
      steps: ['Brown the beef'],
      ingredients: [{ name: 'Beef', measure: grams, amount: 500 }],
      updatedAt: undefined,
    });
  });

  it('returns 404 when the backend reports not found', async () => {
    (backendFetch as jest.Mock).mockResolvedValue({ ok: false, status: 404 });

    const response = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ recipeId }),
    });

    expect(response.status).toBe(404);
  });

  it('proxies other backend error statuses', async () => {
    (backendFetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

    const response = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ recipeId }),
    });

    expect(response.status).toBe(500);
  });
});

describe('PUT /api/recipes/[recipeId]', () => {
  afterEach(() => (backendFetch as jest.Mock).mockReset());

  it('updates the recipe and returns it mapped', async () => {
    mockBackend(
      { ok: true, json: async () => [grams] },
      { ok: true, json: async () => backendRecipe },
    );

    const update = { name: 'Tacos', description: 'Tasty tacos', steps: ['Brown the beef'], ingredients: [] };
    const request = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify(update),
    });
    const response = await PUT(request, { params: Promise.resolve({ recipeId }) });

    expect(backendFetch).toHaveBeenCalledWith(
      `/api/recipes/${recipeId}`,
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ recipeId, ...update }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ recipeId, name: 'Tacos' });
  });

  it('proxies the backend error status', async () => {
    (backendFetch as jest.Mock).mockResolvedValue({ ok: false, status: 400 });

    const request = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ name: '', description: null, steps: [], ingredients: [] }),
    });
    const response = await PUT(request, { params: Promise.resolve({ recipeId }) });

    expect(response.status).toBe(400);
  });
});
