# TODO

## Google Health eat logging

`EatFlow` (`src/components/pantry/EatFlow.tsx`) used to also optionally log the amount
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

The food-search/barcode-match UI, `src/lib/foodSearch.ts`, `MEAL_TYPES`, and the
`/api/google-health/foods/log` proxy route were deleted as dead code (nothing called them —
see the ponytail-audit run on 2026-09-06). The last commit where they still existed intact is
`dd1a4e1` — check out that commit (or `git show dd1a4e1:src/lib/foodSearch.ts` etc.) to recover
the starting point for the real flow once it's designed.

## Thumbnails for the pending pantry list

`GET /api/pantry/pending` returns every capture image at the size it was uploaded, base64 in
JSON. One shop's worth (29 items, 74 photos) is 10.1 MB and takes ~41 s to download over a home
connection, with TTFB at ~1 s — so the body, not the server, is the bottleneck. The list page
(`usePendingCapturedItemsCount`, `src/lib/houses.ts`) only needs to know how many items are
waiting, and the pending list only needs something to recognise an item by; neither needs the
full photo. This landed as "pending items never show up on the website" rather than an obvious
slow load, because the count hook falls back to `0` when the fetch doesn't resolve.

Needs:
- Server-side thumbnails generated on capture (or on upload), stored beside the original —
  a few hundred KB per item, not a few hundred KB per photo.
- The list response carrying the thumbnail, with the full image fetched per item only when it's
  opened for processing.
- The full image kept at a resolution that still decodes barcodes: 400 px decodes 3 of 38 test
  photos, 500 px 17, 600 px 27, 800 px 38 — so 800 px is the floor for the processing view.
- `usePendingCapturedItemsCount` distinguishing "failed to load" from "nothing pending", so the
  next such failure is visible instead of silently reading as an empty queue.
