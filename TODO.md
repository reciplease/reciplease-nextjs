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
