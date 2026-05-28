import type { NextApiRequest, NextApiResponse } from 'next';
import { allMeasures } from '@/lib/measures';

export default function handler(
  _req: NextApiRequest,
  res: NextApiResponse<Measure[]>,
) {
  res.status(200).json(allMeasures);
}
