import useSWR from 'swr';
import Link from 'next/link';
import Metadata from '@/components/Metadata';
import { toDataUrl } from '@/lib/imageCapture';

const fetcher = (url: string): Promise<InventoryItem[]> =>
  fetch(url).then((res) => res.json());

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Whole calendar days between today and the expiration date — negative once
// it's passed. `expiration` is built from its Y/M/D parts (not `new
// Date(expiration)`, which treats a date-only string as UTC midnight and can
// land on the wrong local calendar day) so this matches "today" in whatever
// timezone the browser is in, not UTC.
function daysUntil(expiration: string): number {
  const [year, month, day] = expiration.split('-').map(Number);
  const expiresAt = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((expiresAt.getTime() - today.getTime()) / MS_PER_DAY);
}

function formatDaysLeft(daysLeft: number): string {
  if (daysLeft > 1) return `${daysLeft} days left`;
  if (daysLeft === 1) return '1 day left';
  if (daysLeft === 0) return 'Expires today';
  if (daysLeft === -1) return 'Expired yesterday';
  return `Expired ${Math.abs(daysLeft)} days ago`;
}

type ItemWithDaysLeft = InventoryItem & { daysLeft: number };

function ExpirationSection({ title, items }: { title: string; items: ItemWithDaysLeft[] }) {
  return (
    <div>
      <h4 className={`text-lg font-medium${items.length === 0 ? ' opacity-40' : ''}`}>
        {title}
      </h4>
      {items.length > 0 && (
        <ul className="list-none p-0 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 my-4">
          {items.map((item) => (
            <li key={item.uuid}>
              <Link href={`/inventory/${item.uuid}`}>
                <article className={`p-4 border border-[#ccc] rounded cursor-pointer${item.daysLeft < 0 ? ' opacity-60' : ''}`}>
                  {item.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={toDataUrl(item.image)}
                      alt={item.name}
                      className="w-full aspect-square object-cover rounded mb-2"
                    />
                  )}
                  <h5 className="font-medium">{item.name}</h5>
                  <p>
                    {item.amount}{' '}
                    {item.amount === 1 ? item.measure.singular : item.measure.plural}
                  </p>
                  <p className="text-sm text-[#666]">{formatDaysLeft(item.daysLeft)}</p>
                </article>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ExpiringInventory() {
  const { data: items, error, isLoading } = useSWR('/api/inventory', fetcher);

  if (isLoading) {
    return (
      <>
        <Metadata title="Loading Inventory" description="Loading inventory..." />
        <p>Loading...</p>
      </>
    );
  }

  if (error || !items) {
    return (
      <>
        <Metadata title="Expiring soon" description="Inventory items by expiration date" />
        <p>Could not load inventory</p>
      </>
    );
  }

  const withDaysLeft = items
    .map((item) => ({ ...item, daysLeft: daysUntil(item.expiration) }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  // Already-expired items are folded into "next week" (more urgent than
  // anything still ahead, not a third bucket the user has to check too).
  const nextWeek = withDaysLeft.filter((item) => item.daysLeft <= 7);
  const nextMonth = withDaysLeft.filter((item) => item.daysLeft > 7 && item.daysLeft <= 30);

  return (
    <>
      <Metadata title="Expiring soon" description="Inventory items by expiration date" />

      <section className="grid gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xl font-semibold mr-auto">Expiring soon</h3>
          <Link href="/inventory" className="text-sm underline">← Pantry</Link>
        </div>

        {withDaysLeft.length === 0 ? (
          <p>No items in inventory</p>
        ) : (
          <>
            <ExpirationSection title="In the next week" items={nextWeek} />
            <ExpirationSection title="In the next month" items={nextMonth} />
          </>
        )}
      </section>
    </>
  );
}
