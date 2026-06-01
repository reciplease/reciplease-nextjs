import type { NextApiRequest, NextApiResponse } from 'next';
import { backendFetch } from '@/lib/backend';
import { fetchMeasures, toMeasure } from '@/lib/measures';

type BackendIngredient = {
  uuid: string;
  name: string;
  measure: string;
};

function toIngredient(b: BackendIngredient, measures: Measure[]): Ingredient {
  return {
    uuid: b.uuid,
    name: b.name,
    measure: toMeasure(b.measure, measures),
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Ingredient[] | Ingredient>,
) {
  if (req.method === 'POST') {
    const { name, measureId } = req.body as CreateIngredient;
    const response = await backendFetch('/api/ingredients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, measure: measureId }),
    });
    if (!response.ok) {
      res.status(response.status).end();
      return;
    }
    const b: BackendIngredient = await response.json();
    const measures = await fetchMeasures();
    res.status(201).json(toIngredient(b, measures));
    return;
  }

  const response = await backendFetch('/api/ingredients');
  if (!response.ok) {
    res.status(response.status).end();
    return;
  }
  const backendIngredients: BackendIngredient[] = await response.json();
  const measures = await fetchMeasures();
  res.status(200).json(backendIngredients.map((b) => toIngredient(b, measures)));
}
