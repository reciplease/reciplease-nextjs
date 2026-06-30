import Link from 'next/link';
import { useState } from 'react';
import { recipeTitleTransitionName } from '@/lib/viewTransitionNames';

interface Props {
  recipe: Recipe;
}

export default function RecipePreview({ recipe }: Props) {
  // Only the clicked card's title carries a view-transition-name, so the
  // browser morphs it into the detail page's heading instead of cross-fading
  // the whole page. Name must stay off every other card's title at the same
  // time, since view-transition-name has to be unique in the document.
  const [navigating, setNavigating] = useState(false);

  // The whole card is the click target, styled as one big secondary-bordered
  // button that fills on hover.
  return (
    <Link
      href={`/recipes/${recipe.recipeShortId}`}
      onClick={() => setNavigating(true)}
      className="flex flex-wrap items-center gap-x-8 gap-y-1 rounded-lg border-2 border-secondary p-4 transition-colors transition-transform hover:scale-[1.02] hover:bg-secondary hover:text-white active:scale-[0.98]"
    >
      {/*TODO image?*/}
      <h4
        className="grow basis-48 underline decoration-highlight decoration-2 underline-offset-4"
        style={
          navigating
            ? { viewTransitionName: recipeTitleTransitionName(recipe.recipeId) }
            : undefined
        }
      >
        {recipe.name}
      </h4>
      <p className="line-clamp-2 grow basis-64 text-sm">{recipe.description ?? 'No description found'}</p>
    </Link>
  );
}
