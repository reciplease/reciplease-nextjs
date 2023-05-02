import { NextApiRequest, NextApiResponse } from 'next';
import { recipes } from '@/pages/api/recipes/data';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Recipe>
) {
  const recipeId = req.query.recipeId;

  const maybeRecipe = recipes.find((recipe) => recipe.recipeId === recipeId);

  if (maybeRecipe) {
    res.status(200).json(maybeRecipe);
  } else {
    res.status(404);
  }
}
