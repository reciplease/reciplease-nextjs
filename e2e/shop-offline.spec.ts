import { test, expect, Page } from '@playwright/test';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function mockSession(page: Page) {
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      json: {
        user: { name: 'Owner', email: 'owner@example.com' },
        expires: '2099-01-01T00:00:00.000Z',
      },
    }),
  );
}

test.describe('Shop capture with a flaky connection', () => {
  test('keeps captures across reloads and uploads them in one bulk request once the connection returns', async ({
    page,
    context,
  }) => {
    let connected = false;
    const bulkBodies: { items: { scanId: string; barcodeImage?: string }[] }[] = [];

    await mockSession(page);
    await page.route('**/api/houses', (route) =>
      route.fulfill({ json: [{ id: 'house-1', name: 'Home', role: 'OWNER' }] }),
    );
    await page.route('**/api/pantry/pending', (route) => route.fulfill({ json: [] }));
    await context.route('**/api/pantry/pending/bulk', (route) => {
      if (!connected) return route.abort('failed');
      const body = route.request().postDataJSON();
      bulkBodies.push(body);
      return route.fulfill({
        json: body.items.map((item: { scanId: string }) => ({ scanId: item.scanId, uuid: `pending-${item.scanId}` })),
      });
    });

    const hydrated = page.waitForResponse('**/api/houses');
    await page.goto('/pantry/shop');
    await hydrated;
    await page.evaluate(() => navigator.serviceWorker.ready);

    await page.getByLabel('Take barcode photo').setInputFiles({ name: 'barcode.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByAltText('Barcode photo preview')).toBeVisible();

    await page.reload();
    await expect(page.getByAltText('Barcode photo preview')).toBeVisible();

    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.getByText('1 item saved on this device, waiting to upload.')).toBeVisible();

    await page.reload();
    await expect(page.getByText('1 item saved on this device, waiting to upload.')).toBeVisible();
    expect(bulkBodies).toHaveLength(0);

    connected = true;
    await page.evaluate(() => window.dispatchEvent(new Event('online')));

    await expect(page.getByText(/waiting to upload/)).toBeHidden();
    expect(bulkBodies).toHaveLength(1);
    expect(bulkBodies[0].items).toHaveLength(1);
    expect(bulkBodies[0].items[0].scanId).toMatch(/^[0-9a-f-]{36}$/);
    expect(bulkBodies[0].items[0].barcodeImage).toBeTruthy();
  });
});
