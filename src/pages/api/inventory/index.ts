import type { NextApiRequest, NextApiResponse } from 'next';
import { backendFetch } from '@/lib/backend';
import { toMeasure } from '@/lib/measures';

type BackendInventoryItem = {
  uuid: string;
  ingredientUuid: string;
  name: string;
  measure: string;
  amount: number;
  expiration: string;
};

function toInventoryItem(b: BackendInventoryItem): InventoryItem {
  return {
    uuid: b.uuid,
    ingredientUuid: b.ingredientUuid,
    name: b.name,
    measure: toMeasure(b.measure),
    amount: b.amount,
    expiration: b.expiration,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<InventoryItem[] | InventoryItem>,
) {
  if (req.method === 'POST') {
    const body = req.body as CreateInventoryItem;
    const response = await backendFetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      res.status(response.status).end();
      return;
    }
    const b: BackendInventoryItem = await response.json();
    res.status(201).json(toInventoryItem(b));
    return;
  }

  const response = await backendFetch('/api/inventory');
  if (!response.ok) {
    res.status(response.status).end();
    return;
  }
  const items: BackendInventoryItem[] = await response.json();
  res.status(200).json(items.map(toInventoryItem));
}
