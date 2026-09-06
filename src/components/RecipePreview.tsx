import Link from 'next/link';
import { useState } from 'react';
import { recipeTitleTransitionName } from '@/lib/viewTransitionNames';

interface Props {
  recipe: Recipe;
  onToggleUpvote?: (recipe: Recipe) => void;
  onToggleVisibility?: (recipe: Recipe) => void;
}

export default function RecipePreview({ recipe, onToggleUpvote, onToggleVisibility }: Props) {
  const [navigating, setNavigating] = useState(false);

  return (
    <Link
      href={`/recipes/${recipe.recipeShortId}`}
      onClick={() => setNavigating(true)}
      className="flex flex-wrap items-center gap-x-8 gap-y-1 rounded-lg border-2 border-secondary p-4 transition-colors transition-transform hover:scale-[1.02] hover:bg-secondary hover:text-white active:scale-[0.98]"
    >
      <h4
        className="grow basis-48 underline decoration-highlight decoration-2 underline-offset-4"
        style={
          navigating
            ? { viewTransitionName: recipeTitleTransitionName(recipe.recipeId) }
            : undefined
        }
      >
        {recipe.name}
        {recipe.sourceUrl && (
          <span role="img" aria-label="Has source link" title="Has source link" className="ml-1 no-underline">
            🌐
          </span>
        )}
      </h4>
      <p className="line-clamp-2 grow basis-64 text-sm">{recipe.description ?? 'No description found'}</p>
      <span className="shrink-0 text-xs" onClick={(e) => e.stopPropagation()}>
        {onToggleUpvote ? (
          <button
            type="button"
            aria-pressed={recipe.upvotedByCurrentUser}
            aria-label={recipe.upvotedByCurrentUser ? 'Remove upvote' : 'Upvote'}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleUpvote(recipe);
            }}
            className="mr-2 rounded border border-secondary px-2 py-1 hover:bg-secondary hover:text-white"
          >
            {recipe.upvoteCount} {recipe.upvotedByCurrentUser ? '▲' : '△'}
          </button>
        ) : (
          <span className="mr-2 rounded border border-secondary px-2 py-1" aria-label={`${recipe.upvoteCount} upvotes`}>
            {recipe.upvoteCount} △
          </span>
        )}
      </span>
      <span className="shrink-0 text-xs" onClick={(e) => e.stopPropagation()}>
        {recipe.owned === 'true' ? (
          <button
            type="button"
            aria-pressed={recipe.isPublic}
            aria-label={recipe.isPublic ? 'Make private' : 'Make public'}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleVisibility?.(recipe);
            }}
            className="rounded border border-secondary px-2 py-1 hover:bg-secondary hover:text-white"
          >
            {recipe.isPublic ? 'Public' : 'Private'}
          </button>
        ) : (
          <span className="rounded border border-secondary px-2 py-1">
            {recipe.isPublic ? 'Public' : 'Private'}
          </span>
        )}
      </span>
    </Link>
  );
}
