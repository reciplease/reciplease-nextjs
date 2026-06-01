import type { NextApiRequest, NextApiResponse } from 'next';
import { backendFetch } from '@/lib/backend';
import { fetchMeasureById } from '@/lib/measures';

type BackendInventoryItem = {
  uuid: string;
  ingredientUuid: string;
  name: string;
  measure: string;
  amount: number;
  expiration: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<InventoryItem>,
) {
  const { uuid } = req.query;
  const response = await backendFetch(`/api/inventory/${uuid}`);
  if (response.status === 404) {
    res.status(404).end();
    return;
  }
  if (!response.ok) {
    res.status(response.status).end();
    return;
  }
  const b: BackendInventoryItem = await response.json();
  res.status(200).json({
    uuid: b.uuid,
    ingredientUuid: b.ingredientUuid,
    name: b.name,
    measure: await fetchMeasureById(b.measure),
    amount: b.amount,
    expiration: b.expiration,
  });
}
