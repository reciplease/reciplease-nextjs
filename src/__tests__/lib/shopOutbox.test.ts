/** @jest-environment node */
import 'fake-indexeddb/auto';
import { addCapture, EMPTY_DRAFT, listCaptures, loadDraft, saveDraft } from '@/lib/shopOutbox';

beforeEach(() => {
  indexedDB = new IDBFactory();
});

describe('shopOutbox', () => {
  it('stores captures and lists only the requested house', async () => {
    await addCapture({ scanId: 's1', houseId: 'house-1', capturedAt: 1, barcodeImage: 'a' });
    await addCapture({ scanId: 's2', houseId: 'house-2', capturedAt: 2, barcodeImage: 'b' });

    expect(await listCaptures('house-1')).toEqual([
      { scanId: 's1', houseId: 'house-1', capturedAt: 1, barcodeImage: 'a' },
    ]);
  });

  it('lists captures in the order they were taken', async () => {
    await addCapture({ scanId: 'z', houseId: 'house-1', capturedAt: 1 });
    await addCapture({ scanId: 'a', houseId: 'house-1', capturedAt: 2 });
    await addCapture({ scanId: 'm', houseId: 'house-1', capturedAt: 3 });

    expect((await listCaptures('house-1')).map((capture) => capture.scanId)).toEqual(['z', 'a', 'm']);
  });

  it('adding the same scanId twice keeps one capture', async () => {
    await addCapture({ scanId: 's1', houseId: 'house-1', capturedAt: 1, barcodeImage: 'a' });
    await addCapture({ scanId: 's1', houseId: 'house-1', capturedAt: 1, barcodeImage: 'a' });

    expect(await listCaptures('house-1')).toHaveLength(1);
  });

  it('round-trips a draft per house', async () => {
    const draft = { barcodeImage: 'b', expirationImage: null, measureImage: 'm' };
    await saveDraft('house-1', draft);

    expect(await loadDraft('house-1')).toEqual(draft);
    expect(await loadDraft('house-2')).toEqual(EMPTY_DRAFT);
  });

  it('saving an empty draft clears it', async () => {
    await saveDraft('house-1', { barcodeImage: 'b', expirationImage: null, measureImage: null });
    await saveDraft('house-1', EMPTY_DRAFT);

    expect(await loadDraft('house-1')).toEqual(EMPTY_DRAFT);
  });
});
