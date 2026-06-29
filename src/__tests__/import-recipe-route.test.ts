/** @jest-environment node */
import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/import-recipe/route';

const bbcHtml = fs.readFileSync(
  path.join(__dirname, '__fixtures__/import/bbc-good-food.html'),
  'utf-8',
);
const hellofreshHtml = fs.readFileSync(
  path.join(__dirname, '__fixtures__/import/hellofresh.html'),
  'utf-8',
);
const hellofreshItemListHtml = fs.readFileSync(
  path.join(__dirname, '__fixtures__/import/hellofresh-itemlist.html'),
  'utf-8',
);
const bbcPlainStringHtml = fs.readFileSync(
  path.join(__dirname, '__fixtures__/import/bbc-plain-string-instructions.html'),
  'utf-8',
);
const hellofreshBulletsHtml = fs.readFileSync(
  path.join(__dirname, '__fixtures__/import/hellofresh-bullets.html'),
  'utf-8',
);

global.fetch = jest.fn();

function mockHtml(html: string, status = 200) {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    text: async () => html,
  });
}

function mockNetworkError() {
  (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network failure'));
}

beforeEach(() => (fetch as jest.Mock).mockReset());

function post(body: unknown) {
  return POST(
    new NextRequest('http://localhost/api/import-recipe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

describe('POST /api/import-recipe', () => {
  describe('BBC Good Food (@graph-wrapped JSON-LD)', () => {
    it('returns the parsed recipe', async () => {
      mockHtml(bbcHtml);
      const res = await post({ url: 'https://www.bbcgoodfood.com/recipes/lemon-drizzle-cake' });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe('Lemon drizzle cake');
      expect(body.description).toBe('A foolproof sponge with a sharp citrus drizzle topping.');
      expect(body.isPublic).toBe(false);
    });

    it('parses all 8 ingredients from the BBC fixture', async () => {
      mockHtml(bbcHtml);
      const { ingredients } = await (await post({ url: 'https://www.bbcgoodfood.com/recipes/lemon-drizzle-cake' })).json();
      expect(ingredients).toHaveLength(8);
    });

    it('maps gram ingredients correctly', async () => {
      mockHtml(bbcHtml);
      const { ingredients } = await (await post({ url: 'https://www.bbcgoodfood.com/recipes/lemon-drizzle-cake' })).json();
      const butter = ingredients.find((i: { name: string }) => i.name.includes('butter'));
      expect(butter).toMatchObject({ measureId: 'g', amount: 225 });
    });

    it('maps tbsp ingredients correctly', async () => {
      mockHtml(bbcHtml);
      const { ingredients } = await (await post({ url: 'https://www.bbcgoodfood.com/recipes/lemon-drizzle-cake' })).json();
      const milk = ingredients.find((i: { name: string }) => i.name === 'milk');
      expect(milk).toMatchObject({ measureId: 'tbsp', amount: 2 });
    });

    it('treats unit-less count ingredients as item', async () => {
      mockHtml(bbcHtml);
      const { ingredients } = await (await post({ url: 'https://www.bbcgoodfood.com/recipes/lemon-drizzle-cake' })).json();
      const eggs = ingredients.find((i: { name: string }) => i.name.includes('eggs'));
      expect(eggs).toMatchObject({ measureId: 'item', amount: 4 });
    });

    it('returns all 5 method steps', async () => {
      mockHtml(bbcHtml);
      const { steps } = await (await post({ url: 'https://www.bbcgoodfood.com/recipes/lemon-drizzle-cake' })).json();
      expect(steps).toHaveLength(5);
      expect(steps[0]).toContain('180C');
    });
  });

  describe('HelloFresh (top-level @type: Recipe, multiple JSON-LD blocks)', () => {
    it('returns the parsed recipe', async () => {
      mockHtml(hellofreshHtml);
      const res = await post({ url: 'https://www.hellofresh.com/recipes/creamy-mushroom-pasta' });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe('Creamy Mushroom Pasta');
      expect(body.description).toBe(
        'A comforting weeknight pasta with a rich and garlicky cream sauce.',
      );
    });

    it('parses all 10 ingredients from the HelloFresh fixture', async () => {
      mockHtml(hellofreshHtml);
      const { ingredients } = await (await post({ url: 'https://www.hellofresh.com/recipes/creamy-mushroom-pasta' })).json();
      expect(ingredients).toHaveLength(10);
    });

    it('maps ml ingredients correctly', async () => {
      mockHtml(hellofreshHtml);
      const { ingredients } = await (await post({ url: 'https://www.hellofresh.com/recipes/creamy-mushroom-pasta' })).json();
      const cream = ingredients.find((i: { name: string }) => i.name.includes('cream'));
      expect(cream).toMatchObject({ measureId: 'ml', amount: 150 });
    });

    it('maps fractional quantities correctly (1/2 tsp)', async () => {
      mockHtml(hellofreshHtml);
      const { ingredients } = await (await post({ url: 'https://www.hellofresh.com/recipes/creamy-mushroom-pasta' })).json();
      const chilli = ingredients.find((i: { name: string }) => i.name.includes('chilli'));
      expect(chilli).toMatchObject({ measureId: 'tsp', amount: 0.5 });
    });

    it('skips the Organisation JSON-LD block and finds Recipe in the second block', async () => {
      mockHtml(hellofreshHtml);
      const res = await post({ url: 'https://www.hellofresh.com/recipes/creamy-mushroom-pasta' });
      expect(res.status).toBe(200);
    });

    it('returns all 5 method steps', async () => {
      mockHtml(hellofreshHtml);
      const { steps } = await (await post({ url: 'https://www.hellofresh.com/recipes/creamy-mushroom-pasta' })).json();
      expect(steps).toHaveLength(5);
    });

    it('treats "salt and pepper to taste" as a fallback item ingredient', async () => {
      mockHtml(hellofreshHtml);
      const { ingredients } = await (await post({ url: 'https://www.hellofresh.com/recipes/creamy-mushroom-pasta' })).json();
      const seasoning = ingredients.find((i: { name: string }) => i.name.includes('salt and pepper'));
      expect(seasoning).toMatchObject({ measureId: 'item', amount: 1 });
    });
  });

  describe('HelloFresh ItemList instructions (@type array + ItemList recipeInstructions)', () => {
    it('parses a recipe whose @type is an array containing Recipe', async () => {
      mockHtml(hellofreshItemListHtml);
      const res = await post({ url: 'https://www.hellofresh.com/recipes/spiced-chickpea-stew' });
      expect(res.status).toBe(200);
      expect((await res.json()).name).toBe('Spiced Chickpea Stew');
    });

    it('extracts steps from an ItemList-wrapped recipeInstructions', async () => {
      mockHtml(hellofreshItemListHtml);
      const { steps } = await (await post({ url: 'https://www.hellofresh.com/recipes/spiced-chickpea-stew' })).json();
      expect(steps).toHaveLength(4);
      expect(steps[0]).toBe('Finely dice the onion and garlic.');
    });

    it('parses a mixed-number ingredient (1 1/2 tsp)', async () => {
      mockHtml(hellofreshItemListHtml);
      const { ingredients } = await (await post({ url: 'https://www.hellofresh.com/recipes/spiced-chickpea-stew' })).json();
      const cumin = ingredients.find((i: { name: string }) => i.name.includes('cumin'));
      expect(cumin).toMatchObject({ measureId: 'tsp', amount: 1.5 });
    });

    it('parses all 9 ingredients', async () => {
      mockHtml(hellofreshItemListHtml);
      const { ingredients } = await (await post({ url: 'https://www.hellofresh.com/recipes/spiced-chickpea-stew' })).json();
      expect(ingredients).toHaveLength(9);
    });
  });

  describe('BBC Good Food plain-string recipeInstructions (@graph + string instructions)', () => {
    it('wraps a single instruction string as one step', async () => {
      mockHtml(bbcPlainStringHtml);
      const res = await post({ url: 'https://www.bbcgoodfood.com/recipes/classic-vinaigrette' });
      expect(res.status).toBe(200);
      const { steps } = await res.json();
      expect(steps).toHaveLength(1);
      expect(steps[0]).toContain('Whisk together');
    });

    it('parses all 5 ingredients including a pinch fallback', async () => {
      mockHtml(bbcPlainStringHtml);
      const { ingredients } = await (await post({ url: 'https://www.bbcgoodfood.com/recipes/classic-vinaigrette' })).json();
      expect(ingredients).toHaveLength(5);
      const pinch = ingredients.find((i: { name: string }) => i.name === 'pinch of sugar');
      expect(pinch).toMatchObject({ measureId: 'item', amount: 1 });
    });
  });

  describe('HelloFresh real-world multi-bullet format', () => {
    it('splits bullet-separated sub-steps into individual steps', async () => {
      mockHtml(hellofreshBulletsHtml);
      const { steps } = await (await post({ url: 'https://www.hellofresh.com/recipes/creamy-herb-chicken' })).json();
      // 3 HowToStep objects, each with 2–4 bullet sub-steps → should expand to 8 steps total
      expect(steps.length).toBeGreaterThan(3);
      expect(steps.every((s: string) => !s.startsWith('•'))).toBe(true);
    });

    it('collapses soft-wrapped newlines inside each step', async () => {
      mockHtml(hellofreshBulletsHtml);
      const { steps } = await (await post({ url: 'https://www.hellofresh.com/recipes/creamy-herb-chicken' })).json();
      expect(steps.every((s: string) => !s.includes('\n'))).toBe(true);
    });

    it('strips ***footnote*** markers', async () => {
      mockHtml(hellofreshBulletsHtml);
      const { steps } = await (await post({ url: 'https://www.hellofresh.com/recipes/creamy-herb-chicken' })).json();
      expect(steps.join(' ')).not.toContain('***');
    });

    it('lowercases ingredient names', async () => {
      mockHtml(hellofreshBulletsHtml);
      const { ingredients } = await (await post({ url: 'https://www.hellofresh.com/recipes/creamy-herb-chicken' })).json();
      ingredients.forEach((i: { name: string }) => {
        expect(i.name).toBe(i.name.toLowerCase());
      });
    });

    it('maps "ounce" to the oz measureId', async () => {
      mockHtml(hellofreshBulletsHtml);
      const { ingredients } = await (await post({ url: 'https://www.hellofresh.com/recipes/creamy-herb-chicken' })).json();
      const chicken = ingredients.find((i: { name: string }) => i.name.includes('chicken'));
      expect(chicken).toMatchObject({ name: 'chicken cutlets', measureId: 'oz', amount: 10 });
    });

    it('parses unicode fraction ½ in ingredient amounts', async () => {
      mockHtml(hellofreshBulletsHtml);
      const { ingredients } = await (await post({ url: 'https://www.hellofresh.com/recipes/creamy-herb-chicken' })).json();
      const sourCream = ingredients.find((i: { name: string }) => i.name === 'sour cream');
      expect(sourCream).toMatchObject({ measureId: 'tbsp', amount: 1.5 });
    });

    it('parses unicode fraction ¼ and maps cup measureId', async () => {
      mockHtml(hellofreshBulletsHtml);
      const { ingredients } = await (await post({ url: 'https://www.hellofresh.com/recipes/creamy-herb-chicken' })).json();
      const stock = ingredients.find((i: { name: string }) => i.name.includes('stock'));
      expect(stock).toMatchObject({ measureId: 'cup', amount: 0.25 });
    });
  });

  describe('error handling', () => {
    it('returns 400 for a disallowed domain', async () => {
      const res = await post({ url: 'https://www.example.com/recipe' });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/BBC Good Food|HelloFresh/);
    });

    it('returns 400 for a missing url field', async () => {
      const res = await post({});
      expect(res.status).toBe(400);
    });

    it('returns 400 for an invalid URL string', async () => {
      const res = await post({ url: 'not-a-url' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for a malformed request body', async () => {
      const res = await POST(
        new NextRequest('http://localhost/api/import-recipe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'not json',
        }),
      );
      expect(res.status).toBe(400);
    });

    it('returns 404 when the page contains no Recipe JSON-LD', async () => {
      mockHtml('<html><body>No recipe here</body></html>');
      const res = await post({ url: 'https://www.bbcgoodfood.com/recipes/no-schema' });
      expect(res.status).toBe(404);
      expect((await res.json()).error).toMatch(/no recipe/i);
    });

    it('returns 404 when JSON-LD is present but has no Recipe type', async () => {
      mockHtml(`<html><head>
        <script type="application/ld+json">{"@type":"WebPage","name":"About"}</script>
      </head></html>`);
      const res = await post({ url: 'https://www.bbcgoodfood.com/recipes/wrong-type' });
      expect(res.status).toBe(404);
    });

    it('returns 404 when JSON-LD is malformed (skipped) and no valid Recipe block exists', async () => {
      mockHtml(`<html><head>
        <script type="application/ld+json">{ broken json }</script>
      </head></html>`);
      const res = await post({ url: 'https://www.bbcgoodfood.com/recipes/bad-json' });
      expect(res.status).toBe(404);
    });

    it('returns 502 when the upstream page returns a non-OK status', async () => {
      mockHtml('', 404);
      const res = await post({ url: 'https://www.bbcgoodfood.com/recipes/gone' });
      expect(res.status).toBe(502);
    });

    it('returns 502 when the upstream fetch throws (network error)', async () => {
      mockNetworkError();
      const res = await post({ url: 'https://www.bbcgoodfood.com/recipes/timeout' });
      expect(res.status).toBe(502);
    });
  });
});
