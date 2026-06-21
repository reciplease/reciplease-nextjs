/** @jest-environment node */
import { PUT } from '@/app/api/recipes/[recipeId]/ingredients/route';

jest.mock('@/lib/backend', () => ({ backendFetch: jest.fn() }));

const { backendFetch } = require('@/lib/backend');

const recipeId = '5f1d8a2b3c4d5e6f70819203';

describe('PUT /api/recipes/[recipeId]/ingredients', () => {
  afterEach(() => (backendFetch as jest.Mock).mockReset());

  it('adds the ingredient and returns the backend response', async () => {
    const ingredient = { name: 'Beef', measure: 'GRAMS', amount: 500 };
    (backendFetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ recipeId, ...ingredient }),
    });

    const request = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify(ingredient),
    });
    const response = await PUT(request, { params: Promise.resolve({ recipeId }) });

    expect(backendFetch).toHaveBeenCalledWith(
      `/api/recipes/${recipeId}/ingredients`,
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(ingredient),
      }),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ recipeId, ...ingredient });
  });

  it('proxies the backend error status', async () => {
    (backendFetch as jest.Mock).mockResolvedValue({ ok: false, status: 400 });

    const request = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ name: '', measure: '', amount: 0 }),
    });
    const response = await PUT(request, { params: Promise.resolve({ recipeId }) });

    expect(response.status).toBe(400);
  });
});
