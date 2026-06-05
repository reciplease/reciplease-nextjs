import Link from 'next/link';

interface Props {
  recipe: Recipe;
}

export default function RecipePreview({ recipe }: Props) {
  // The whole card is the click target, styled as one big secondary-bordered
  // button that fills on hover.
  return (
    <Link
      href={`/recipes/${recipe.recipeShortId}`}
      className="grid h-full max-w-[30ch] gap-2 rounded-lg border-2 border-secondary p-4 transition-colors hover:bg-secondary hover:text-white"
    >
      {/*TODO image?*/}
      <h4 className="underline decoration-highlight decoration-2 underline-offset-4">
        {recipe.name}
      </h4>
      <p>{recipe.description ?? 'No description found'}</p>
    </Link>
  );
}
