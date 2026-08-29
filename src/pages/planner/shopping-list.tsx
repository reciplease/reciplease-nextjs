import Link from 'next/link';
import Metadata from '@/components/Metadata';
import { useActiveHouse } from '@/lib/houses';
import { toShoppingList } from '@/lib/plannedMeals';
import { useFindShoppingList } from '@/types/generated/client';
import { isSuccessResponse } from '@/lib/apiClientMutator';

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const today = new Date();
const rangeStart = toIsoDate(today);
const rangeEnd = toIsoDate(new Date(today.getTime() + 13 * 24 * 60 * 60 * 1000));

export default function ShoppingListPage() {
  const activeHouse = useActiveHouse();
  // Note: unlike the previous hand-written SWR key (which included
  // activeHouse.id), the generated hook's cache key is just
  // ['/api/planned-meals/shopping-list', { start, end }] — switching houses
  // won't by itself bust this cache. Gating on `enabled` still avoids
  // fetching before a house is selected.
  const { data: shoppingListResponse, error, isLoading } = useFindShoppingList(
    { start: rangeStart, end: rangeEnd },
    { swr: { enabled: Boolean(activeHouse) } },
  );
  const shoppingList = shoppingListResponse && isSuccessResponse(shoppingListResponse)
    ? toShoppingList(shoppingListResponse.data)
    : undefined;
  const shoppingListError = error || (shoppingListResponse && !isSuccessResponse(shoppingListResponse));

  if (!activeHouse || isLoading) {
    return (
      <>
        <Metadata title="Loading Shopping List" description="Loading shopping list..." />
        <p>Loading...</p>
      </>
    );
  }

  if (shoppingListError || !shoppingList) {
    return (
      <>
        <Metadata title="Shopping List" description="Ingredients you still need" />
        <p>Could not load the shopping list</p>
      </>
    );
  }

  const items = [...shoppingList.items].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <Metadata title="Shopping List" description="Ingredients you still need" />

      <section className="grid gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xl font-semibold mr-auto">Shopping list</h3>
          <Link href="/planner" className="text-sm underline">← Planner</Link>
        </div>

        <p className="text-sm text-[#666]">
          Ingredients planned in the next two weeks that aren&apos;t already covered by your pantry.
        </p>

        {items.length === 0 ? (
          <p>Nothing to buy — everything planned is already covered</p>
        ) : (
          <ul className="list-none p-0 grid gap-2 my-4">
            {items.map((item, index) => (
              <li key={index} className="flex gap-2 border-b border-[#eee] pb-2">
                <span className="font-medium">{item.amount} {item.measure}</span>
                <span>{item.name}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
