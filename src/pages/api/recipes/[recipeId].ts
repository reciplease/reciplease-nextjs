import { NextApiRequest, NextApiResponse } from 'next';
import { recipe } from '@/pages/api/recipes/example';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Recipe>
) {
  if (req.query.recipeId === recipe.recipeId) {
    res.status(200).json(recipe);
  } else {
    res.status(404);
  }
}
