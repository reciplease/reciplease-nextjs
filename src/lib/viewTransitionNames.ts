// Shared `view-transition-name` between a recipe's card title (list page) and
// its heading (detail page), so a click morphs one into the other instead of
// cross-fading the whole page. Centralised so both pages stay in sync.
export function recipeTitleTransitionName(recipeId: string): string {
  return `recipe-title-${recipeId}`;
}
