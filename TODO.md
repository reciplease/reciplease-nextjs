# TODO

## Meal Planner

The backend already has a `PlannedRecipe` model (`recipe: Recipe`, `date: LocalDate`) with full repository support (`PlannedRecipeRepository`).

Once built, the planner feature needs:
- `GET /api/planner` — fetch planned recipes (proxy `GET /api/planner` on backend)
- `POST /api/planner` — add a recipe to a date (`{ recipeId, date }`)
- `/planner` page — weekly calendar view showing recipes per day
- Ability to click a day to add/remove a recipe
