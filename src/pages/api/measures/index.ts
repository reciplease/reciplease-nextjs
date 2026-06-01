import type { NextApiRequest, NextApiResponse } from 'next';
import { backendFetch } from '@/lib/backend';

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse<Measure[]>,
) {
  const response = await backendFetch('/api/measures');
  if (!response.ok) {
    res.status(response.status).end();
    return;
  }
  const measures: Measure[] = await response.json();
  res.status(200).json(measures);
}
