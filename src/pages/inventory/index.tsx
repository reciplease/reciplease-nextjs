import useSWR from 'swr';
import Link from 'next/link';
import Metadata from '@/components/Metadata';
import styles from './Inventory.module.scss';

const fetcher = (url: string): Promise<InventoryItem[]> =>
  fetch(url).then((res) => res.json());

function isExpired(expiration: string): boolean {
  return new Date(expiration) < new Date();
}

export default function InventoryList() {
  const { data: items, error, isLoading } = useSWR('/api/inventory', fetcher);

  if (isLoading) {
    return (
      <>
        <Metadata title="Loading Inventory" description="Loading inventory..." />
        <section className={styles.inventory}>
          <p>Loading...</p>
        </section>
      </>
    );
  }

  if (error || !items) {
    return (
      <>
        <Metadata title="Inventory" description="Your ingredient inventory" />
        <section className={styles.inventory}>
          <p>Could not load inventory</p>
        </section>
      </>
    );
  }

  return (
    <>
      <Metadata title="Inventory" description="Your ingredient inventory" />

      <section className={styles.inventory}>
        <div className={styles.header}>
          <h3>Inventory</h3>
          <div className={styles.actions}>
            <Link href="/ingredients/create">
              <button>Add ingredient</button>
            </Link>
            <Link href="/inventory/create">
              <button>Add to inventory</button>
            </Link>
          </div>
        </div>

        {items.length === 0 ? (
          <p>No items in inventory</p>
        ) : (
          <ul className={styles.items}>
            {items.map((item) => (
              <li
                key={item.uuid}
                className={isExpired(item.expiration) ? styles.expired : ''}
              >
                <Link href={`/inventory/${item.uuid}`}>
                  <article className={styles.item}>
                    <h4>{item.name}</h4>
                    <p>
                      {item.amount}{' '}
                      {item.amount === 1
                        ? item.measure.singular
                        : item.measure.plural}
                    </p>
                    <p className={styles.expiration}>
                      Expires: {item.expiration}
                      {isExpired(item.expiration) && ' (expired)'}
                    </p>
                  </article>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
