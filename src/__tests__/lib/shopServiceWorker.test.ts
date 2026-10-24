/** @jest-environment node */
import 'fake-indexeddb/auto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { addCapture as storeCapture, listCaptures, type ShopCapture } from '@/lib/shopOutbox';

const addCapture = (capture: Omit<ShopCapture, 'capturedAt'>) =>
  storeCapture({ ...capture, capturedAt: Number(capture.scanId.slice(1)) });

type Listener = (event: Record<string, unknown>) => void;

const source = readFileSync(join(process.cwd(), 'public/sw.js'), 'utf8');

function loadServiceWorker(fetchMock: jest.Mock) {
  const listeners: Record<string, Listener> = {};
  const clientMessages: unknown[] = [];
  const scope = {
    addEventListener: (type: string, listener: Listener) => {
      listeners[type] = listener;
    },
    skipWaiting: jest.fn(),
    clients: {
      claim: jest.fn(),
      matchAll: async () => [{ postMessage: (message: unknown) => clientMessages.push(message) }],
    },
  };
  new Function('self', 'indexedDB', 'fetch', source)(scope, indexedDB, fetchMock);

  async function dispatch(type: string, extra: Record<string, unknown> = {}) {
    const waits: Promise<unknown>[] = [];
    listeners[type]({ ...extra, waitUntil: (promise: Promise<unknown>) => waits.push(promise) });
    await Promise.all(waits);
  }
  return { scope, dispatch, clientMessages };
}

function receiptsFor(request: { body: string }) {
  const { items } = JSON.parse(request.body) as { items: { scanId: string }[] };
  return { ok: true, status: 200, json: async () => items.map((item) => ({ scanId: item.scanId, uuid: `u-${item.scanId}` })) };
}

beforeEach(() => {
  indexedDB = new IDBFactory();
});

describe('shop service worker', () => {
  it('takes over immediately on install and activate', async () => {
    const { scope, dispatch } = loadServiceWorker(jest.fn());

    await dispatch('install');
    await dispatch('activate');

    expect(scope.skipWaiting).toHaveBeenCalled();
    expect(scope.clients.claim).toHaveBeenCalled();
  });

  it('uploads every waiting capture in one bulk request with the house header, then clears them', async () => {
    await addCapture({ scanId: 's1', houseId: 'house-1', barcodeImage: 'a' });
    await addCapture({ scanId: 's2', houseId: 'house-1', measureImage: 'm' });
    const fetchMock = jest.fn(async (_url: string, request: { body: string }) => receiptsFor(request));
    const { dispatch, clientMessages } = loadServiceWorker(fetchMock);

    await dispatch('sync', { tag: 'shop-upload' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0] as unknown as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(url).toBe('/api/pantry/pending/bulk');
    expect(request.method).toBe('POST');
    expect(request.headers['X-RCPLS-House-Id']).toBe('house-1');
    expect(JSON.parse(request.body)).toEqual({
      items: [
        { scanId: 's1', barcodeImage: 'a' },
        { scanId: 's2', measureImage: 'm' },
      ],
    });
    expect(await listCaptures('house-1')).toEqual([]);
    expect(clientMessages).toContainEqual({ type: 'shop-outbox-changed' });
  });

  it('uploads captures in the order they were taken', async () => {
    await addCapture({ scanId: 's3', houseId: 'house-1', barcodeImage: 'c' });
    await addCapture({ scanId: 's1', houseId: 'house-1', barcodeImage: 'a' });
    await addCapture({ scanId: 's2', houseId: 'house-1', barcodeImage: 'b' });
    const fetchMock = jest.fn(async (_url: string, request: { body: string }) => receiptsFor(request));
    const { dispatch } = loadServiceWorker(fetchMock);

    await dispatch('sync', { tag: 'shop-upload' });

    const sent = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(sent.items.map((item: { scanId: string }) => item.scanId)).toEqual(['s1', 's2', 's3']);
  });

  it('keeps captures and fails the sync when the request errors, so the browser retries', async () => {
    await addCapture({ scanId: 's1', houseId: 'house-1', barcodeImage: 'a' });
    const { dispatch } = loadServiceWorker(jest.fn().mockRejectedValue(new TypeError('offline')));

    await expect(dispatch('sync', { tag: 'shop-upload' })).rejects.toThrow('offline');

    expect(await listCaptures('house-1')).toHaveLength(1);
  });

  it('keeps captures when the server rejects the batch', async () => {
    await addCapture({ scanId: 's1', houseId: 'house-1', barcodeImage: 'a' });
    const { dispatch } = loadServiceWorker(jest.fn().mockResolvedValue({ ok: false, status: 401 }));

    await expect(dispatch('sync', { tag: 'shop-upload' })).rejects.toThrow('401');

    expect(await listCaptures('house-1')).toHaveLength(1);
  });

  it('only removes the captures the server acknowledged', async () => {
    await addCapture({ scanId: 's1', houseId: 'house-1', barcodeImage: 'a' });
    await addCapture({ scanId: 's2', houseId: 'house-1', barcodeImage: 'b' });
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ scanId: 's1', uuid: 'u1' }],
    });
    const { dispatch } = loadServiceWorker(fetchMock);

    await dispatch('sync', { tag: 'shop-upload' });

    expect((await listCaptures('house-1')).map((capture) => capture.scanId)).toEqual(['s2']);
  });

  it('sends each house in its own request', async () => {
    await addCapture({ scanId: 's1', houseId: 'house-1', barcodeImage: 'a' });
    await addCapture({ scanId: 's2', houseId: 'house-2', barcodeImage: 'b' });
    const fetchMock = jest.fn(async (_url: string, request: { body: string }) => receiptsFor(request));
    const { dispatch } = loadServiceWorker(fetchMock);

    await dispatch('sync', { tag: 'shop-upload' });

    const houses = fetchMock.mock.calls.map(
      (call) => (call as unknown as [string, { headers: Record<string, string> }])[1].headers['X-RCPLS-House-Id'],
    );
    expect(houses).toEqual(['house-1', 'house-2']);
  });

  it('splits an oversized backlog into several requests', async () => {
    const big = 'x'.repeat(1_200_000);
    await addCapture({ scanId: 's1', houseId: 'house-1', barcodeImage: big });
    await addCapture({ scanId: 's2', houseId: 'house-1', barcodeImage: big });
    await addCapture({ scanId: 's3', houseId: 'house-1', barcodeImage: big });
    const fetchMock = jest.fn(async (_url: string, request: { body: string }) => receiptsFor(request));
    const { dispatch } = loadServiceWorker(fetchMock);

    await dispatch('sync', { tag: 'shop-upload' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await listCaptures('house-1')).toEqual([]);
  });

  it('shares one upload between simultaneous triggers', async () => {
    await addCapture({ scanId: 's1', houseId: 'house-1', barcodeImage: 'a' });
    const fetchMock = jest.fn(async (_url: string, request: { body: string }) => receiptsFor(request));
    const { dispatch } = loadServiceWorker(fetchMock);

    await Promise.all([dispatch('sync', { tag: 'shop-upload' }), dispatch('message', { data: { type: 'flush-shop' } })]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('swallows upload failures triggered by a page message', async () => {
    await addCapture({ scanId: 's1', houseId: 'house-1', barcodeImage: 'a' });
    const { dispatch } = loadServiceWorker(jest.fn().mockRejectedValue(new TypeError('offline')));

    await expect(dispatch('message', { data: { type: 'flush-shop' } })).resolves.toBeUndefined();
  });

  it('ignores unrelated sync tags and messages', async () => {
    await addCapture({ scanId: 's1', houseId: 'house-1', barcodeImage: 'a' });
    const fetchMock = jest.fn();
    const { dispatch } = loadServiceWorker(fetchMock);

    await dispatch('sync', { tag: 'something-else' });
    await dispatch('message', { data: { type: 'other' } });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
