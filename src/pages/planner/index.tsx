import { useState } from 'react';
import Link from 'next/link';
import Metadata from '@/components/Metadata';
import LoadingBox from '@/components/LoadingBox';
import WeekCalendar from '@/components/planner/WeekCalendar';
import { useActiveHouse } from '@/lib/houses';
import { formatDate } from '@/lib/formatDate';
import { toPlannedMeal, type BackendPlannedMeal } from '@/lib/plannedMeals';
import { addDays, mondayOf, toIsoDate } from '@/lib/week';
import { shorten } from '@/lib/recipe-id';
import { useFindPlannedMealsByDateRange, markPlannedMealEaten } from '@/types/generated/client';
import { isSuccessResponse, describeErrorStatus } from '@/lib/apiClientMutator';

export default function Planner() {
  const activeHouse = useActiveHouse();
  const [selectedMonday, setSelectedMonday] = useState(() => toIsoDate(mondayOf(new Date())));
  // The calendar's visible month grid — always a superset of the selected
  // week — reported by WeekCalendar so we can fetch enough data to outline
  // every planned day on screen, not just the selected week.
  const [visibleRange, setVisibleRange] = useState<{ start: string; end: string } | null>(null);

  const rangeStart = selectedMonday;
  const rangeEnd = toIsoDate(addDays(new Date(`${selectedMonday}T00:00:00`), 6));

  const fetchStart = visibleRange?.start ?? rangeStart;
  const fetchEnd = visibleRange?.end ?? rangeEnd;

  // Note: unlike the previous hand-written SWR key (which included
  // activeHouse.id), the generated hook's cache key is just
  // ['/api/planned-meals', { start, end }] — switching houses won't by itself
  // bust this cache. Gating on `enabled` still avoids fetching before a
  // house is selected.
  const { data: mealsResponse, error, isLoading, mutate } = useFindPlannedMealsByDateRange(
    { start: fetchStart, end: fetchEnd },
    { swr: { enabled: Boolean(activeHouse) } },
  );
  const meals = mealsResponse && isSuccessResponse(mealsResponse)
    ? mealsResponse.data.map((m) => toPlannedMeal(m as BackendPlannedMeal))
    : undefined;
  const mealsError = error || (mealsResponse && !isSuccessResponse(mealsResponse));

  const plannedDates = new Set(meals?.map((meal) => meal.date));
  const weekMeals = meals?.filter((meal) => meal.date >= rangeStart && meal.date <= rangeEnd);

  return (
    <>
      <Metadata title="Planner" description="Plan what you'll eat" />

      <section className="grid gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xl font-semibold mr-auto">Planner</h3>
          <Link href="/planner/shopping-list" className="text-sm underline">Shopping list →</Link>
        </div>

        <WeekCalendar
          selectedMonday={selectedMonday}
          onSelect={setSelectedMonday}
          plannedDates={plannedDates}
          onVisibleRangeChange={(start, end) => setVisibleRange({ start, end })}
        />

        <p className="font-medium">
          {formatDate(rangeStart)} – {formatDate(rangeEnd)}
        </p>

        {!activeHouse || isLoading ? (
          <LoadingBox label="Loading..." className="min-h-64" />
        ) : mealsError || !weekMeals ? (
          <p>Could not load planned meals</p>
        ) : (
          <MealList meals={weekMeals} editable={activeHouse.role === 'OWNER'} onEaten={() => mutate()} />
        )}
      </section>
    </>
  );
}

function MealList({ meals, editable, onEaten }: { meals: PlannedMeal[]; editable: boolean; onEaten: () => void }) {
  const sorted = [...meals].sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length === 0) return <p>No meals planned this week</p>;

  return (
    <ul className="list-none p-0 grid gap-3 my-8">
      {sorted.map((meal) => (
        <MealListItem key={meal.plannedMealId} meal={meal} editable={editable} onEaten={onEaten} />
      ))}
    </ul>
  );
}

function MealListItem({ meal, editable, onEaten }: { meal: PlannedMeal; editable: boolean; onEaten: () => void }) {
  const [markingEaten, setMarkingEaten] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasAllocations = meal.items.some((item) => item.allocations.length > 0);

  async function handleMarkEaten() {
    setError(null);
    setMarkingEaten(true);
    try {
      const result = await markPlannedMealEaten(meal.plannedMealId);
      if (!isSuccessResponse(result)) {
        setError(describeErrorStatus(result.status));
        return;
      }
      onEaten();
    } catch {
      setError('Failed to mark as eaten. Please try again.');
    } finally {
      setMarkingEaten(false);
    }
  }

  return (
    <li className="border border-[#ccc] rounded p-3">
      <div className="flex items-baseline gap-3">
        <span className="text-sm text-[#666] shrink-0">{meal.date}</span>
        <h4 className="font-medium">{meal.name}</h4>
        <div className="ml-auto flex items-baseline gap-3">
          {meal.recipe && (
            <Link href={`/recipes/${shorten(meal.recipe.recipeId)}`} className="text-sm underline">
              {meal.recipe.name}
            </Link>
          )}
          {editable && meal.eatenAt && <span className="text-sm text-[#666]">Eaten</span>}
          {editable && !meal.eatenAt && hasAllocations && (
            <button type="button" onClick={handleMarkEaten} disabled={markingEaten} className="p-0 border-0 text-sm underline">
              {markingEaten ? 'Marking…' : 'Mark eaten'}
            </button>
          )}
          {editable && (
            <Link href={`/planner/${meal.plannedMealShortId}/edit`} className="text-sm underline">
              Edit
            </Link>
          )}
        </div>
      </div>
      {meal.items.length > 0 && (
        <ul className="list-none p-0 mt-2 text-sm text-[#666] grid gap-0.5">
          {meal.items.map((item, itemIndex) => (
            <li key={itemIndex}>
              {item.ingredient.amount} {item.ingredient.measure} {item.ingredient.name}
              {item.allocations.length === 0 && ' (to buy)'}
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="text-sm text-red-600 mt-1">{error}</p>}
    </li>
  );
}
