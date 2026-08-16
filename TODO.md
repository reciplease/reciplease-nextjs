# TODO

## Meal Planner

The backend now supports **planning a recipe with inventory pairings**. A `PlannedRecipe`
holds `recipe`, `date`, and a list of `IngredientPairing`s — each pairing links one
`RecipeIngredient` (the recipe's free-text name/measure/amount) to one or more
`InventoryAllocation`s (`inventoryItemId`, `barcode`, `amount`). More than one inventory
item can be allocated to a single recipe ingredient when one item doesn't cover the amount.

Backend endpoints available:
- `POST /api/planned-recipes` — plan a recipe: `{ recipeId, date, pairings: [{ recipeIngredient, allocations: [{ inventoryItemId, amount }] }] }`. The backend validates each inventory item and snapshots its barcode onto the saved plan.
- `GET /api/planned-recipes/{recipeId}/suggestions?ingredient={name}` — suggests current inventory items for a recipe ingredient, driven by the barcodes paired with that ingredient in previous plans (falls back to a name match).

Once built, the planner feature needs:
- A BFF proxy for the two endpoints above (e.g. `src/app/api/planned-recipes/...`).
- `/planner` page — weekly calendar view showing planned recipes per day.
- A "plan this recipe" flow: pick a date, then for each recipe ingredient choose inventory
  item(s) and amounts, surfacing the suggestions endpoint (which leans on the barcode
  recorded against inventory items when scanning/adding them).
- Ability to click a day to add/remove a planned recipe.

> Note: the old standalone ingredient catalog has been removed. Recipe ingredients are now
> self-contained (name + measure + amount) and inventory items carry their own
> name/measure plus an optional `barcode`; the two are only linked at planning time.

## Google Health eat logging

`EatFlow` (`src/components/inventory/EatFlow.tsx`) used to also optionally log the amount
eaten to Google Health's food diary — a food-search/barcode-match sub-flow picked a food,
then `POST /api/google-health/foods/log` on save. That's been pulled out for now: it only
ever covered eating a single inventory item one at a time, with no equivalent for eating a
full planned meal (`/planner` — see the Meal Planner section above), which is the more
common real case (a meal is usually several ingredients from several inventory items, plus
recipe-level nutrition rather than per-item).

Needs a proper design before reintroducing:
- A Google Health logging entry point from the planner's "mark eaten" flow (`PlannedMeal`),
  not just the inventory item detail page — logging the whole meal's foods/nutrients in one
  go, not one API item at a time.
- The inventory item detail page's `EatFlow` should still be able to log a single item eaten
  outside of any meal (e.g. a snack), reusing the same underlying logging call.
- Whatever shape that shared logging call takes, both entry points should go through it,
  rather than duplicating the food-search-then-log UI in two places.

The removed food-search/barcode-match UI and the `/api/google-health/foods/log` proxy route
are both still intact (see `src/lib/googleHealth.ts`, `src/lib/foodSearch.ts`,
`src/components/scanner/BarcodeScanner.tsx`) — only `EatFlow`'s use of them was removed, as
a starting point to build the real flow from once it's designed.
