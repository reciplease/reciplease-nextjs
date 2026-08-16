# TODO

## Planner ingredient suggestions

`GET /api/planned-recipes/{recipeId}/suggestions?ingredient={name}` exists on the backend
(suggests current inventory items for a recipe ingredient, driven by the barcodes paired with
that ingredient in previous plans, falling back to a name match) but isn't wired up anywhere
in the frontend. `PlannedMealForm` (`src/components/PlannedMealForm.tsx`) currently makes the
user manually pick an inventory item from the full list for each ingredient row — using the
suggestions endpoint to pre-rank/pre-fill that picker would save the repetitive lookup.

## Google Health eat logging

`EatFlow` (`src/components/inventory/EatFlow.tsx`) used to also optionally log the amount
eaten to Google Health's food diary — a food-search/barcode-match sub-flow picked a food,
then `POST /api/google-health/foods/log` on save. That's been pulled out for now: it only
ever covered eating a single inventory item one at a time, with no equivalent for eating a
full planned meal (`/planner`), which is the more common real case (a meal is usually several
ingredients from several inventory items, plus recipe-level nutrition rather than per-item).

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
