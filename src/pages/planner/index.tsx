import useSWR from 'swr';
import Link from 'next/link';
import Metadata from '@/components/Metadata';
import { apiFetch, useActiveHouse } from '@/lib/houses';
import { toPlannedMeal, type BackendPlannedMeal } from '@/lib/plannedMeals';

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const today = new Date();
const rangeStart = toIsoDate(startOfWeek(today));
const rangeEnd = toIsoDate(new Date(startOfWeek(today).getTime() + 6 * 24 * 60 * 60 * 1000));

const fetcher = async (url: string): Promise<PlannedMeal[]> => {
  const res = await apiFetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  const backendMeals: BackendPlannedMeal[] = await res.json();
  return backendMeals.map(toPlannedMeal);
};

export default function Planner() {
  const activeHouse = useActiveHouse();
  const { data: meals, error, isLoading } = useSWR(
    activeHouse ? ['/api/planned-meals', activeHouse.id, rangeStart, rangeEnd] : null,
    () => fetcher(`/api/planned-meals?start=${rangeStart}&end=${rangeEnd}`),
  );

  if (!activeHouse || isLoading) {
    return (
      <>
        <Metadata title="Loading Planner" description="Loading planned meals..." />
        <p>Loading...</p>
      </>
    );
  }

  if (error || !meals) {
    return (
      <>
        <Metadata title="Planner" description="Plan what you'll eat" />
        <p>Could not load planned meals</p>
      </>
    );
  }

  const sorted = [...meals].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <>
      <Metadata title="Planner" description="Plan what you'll eat" />

      <section className="grid gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xl font-semibold mr-auto">Planner</h3>
          <Link href="/planner/shopping-list" className="text-sm underline">Shopping list →</Link>
        </div>

        {sorted.length === 0 ? (
          <p>No meals planned this week</p>
        ) : (
          <ul className="list-none p-0 grid gap-3 my-8">
            {sorted.map((meal) => (
              <li key={`${meal.date}-${meal.name}`} className="border border-[#ccc] rounded p-3">
                <div className="flex items-baseline gap-3">
                  <span className="text-sm text-[#666] shrink-0">{meal.date}</span>
                  <h4 className="font-medium">{meal.name}</h4>
                  {meal.recipe && (
                    <Link href={`/recipes/${meal.recipe.recipeShortId}`} className="text-sm underline ml-auto">
                      {meal.recipe.name}
                    </Link>
                  )}
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
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
