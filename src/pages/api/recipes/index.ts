// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next';
import { recipe } from '@/pages/api/recipes/example';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Recipe[]>
) {
  res.status(200).json([recipe]);
}
