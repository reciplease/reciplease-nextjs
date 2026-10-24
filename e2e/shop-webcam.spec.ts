import { test, expect } from '@playwright/test';

test.use({
  permissions: ['camera'],
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
});

test.skip(({ isMobile }) => isMobile, 'phones use the native camera input instead of the webcam preview');

test.describe('Shop capture on a laptop with a webcam', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/session', (route) =>
      route.fulfill({
        json: { user: { name: 'Owner', email: 'owner@example.com' }, expires: '2099-01-01T00:00:00.000Z' },
      }),
    );
    await page.route('**/api/houses', (route) =>
      route.fulfill({ json: [{ id: 'house-1', name: 'Home', role: 'OWNER' }] }),
    );
    await page.route('**/api/pantry/pending', (route) => route.fulfill({ json: [] }));
  });

  test('takes a photo from the webcam and shows its preview', async ({ page }) => {
    await page.goto('/pantry/shop');

    await page.getByRole('button', { name: 'Take barcode photo', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Webcam' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Capture' })).toBeEnabled();
    await dialog.getByRole('button', { name: 'Capture' }).click();

    await expect(dialog).toBeHidden();
    const preview = page.getByAltText('Barcode photo preview');
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute('src', /^data:image\/jpeg;base64,.{100,}/);
    await expect(page.getByRole('button', { name: 'Retake barcode photo', exact: true })).toBeVisible();
  });

  test('keeps the webcam photo across a reload', async ({ page }) => {
    await page.goto('/pantry/shop');
    await page.getByRole('button', { name: 'Take barcode photo', exact: true }).click();
    await page.getByRole('dialog', { name: 'Webcam' }).getByRole('button', { name: 'Capture' }).click();
    await expect(page.getByAltText('Barcode photo preview')).toBeVisible();

    await page.reload();

    await expect(page.getByAltText('Barcode photo preview')).toBeVisible();
  });

  test('cancelling leaves the capture empty', async ({ page }) => {
    await page.goto('/pantry/shop');

    await page.getByRole('button', { name: 'Take barcode photo', exact: true }).click();
    await page.getByRole('dialog', { name: 'Webcam' }).getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByAltText('Barcode photo preview')).toBeHidden();
  });
});
