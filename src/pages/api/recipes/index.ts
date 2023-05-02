// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next';
import { recipes } from '@/pages/api/recipes/data';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Recipe[]>
) {
  res.status(200).json(recipes);
}
