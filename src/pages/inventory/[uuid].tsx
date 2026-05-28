import useSWR from 'swr';
import { GetServerSidePropsContext } from 'next';
import Link from 'next/link';
import Metadata from '@/components/Metadata';
import styles from './Inventory.module.scss';

const fetcher = (url: string): Promise<InventoryItem> =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error('Not found');
    return res.json();
  });

interface Props {
  uuid: string;
}

function isExpired(expiration: string): boolean {
  return new Date(expiration) < new Date();
}

export default function InventoryItemPage({ uuid }: Props) {
  const { data: item, error, isLoading } = useSWR(`/api/inventory/${uuid}`, fetcher);

  if (isLoading) {
    return (
      <>
        <Metadata title="Loading" description="Loading inventory item..." />
        <section className={styles.inventory}>
          <p>Loading...</p>
        </section>
      </>
    );
  }

  if (error || !item) {
    return (
      <>
        <Metadata title="Not Found" description="Inventory item not found" />
        <section className={styles.inventory}>
          <p>Item not found</p>
          <Link href="/inventory">Back to inventory</Link>
        </section>
      </>
    );
  }

  const expired = isExpired(item.expiration);

  return (
    <>
      <Metadata title={item.name} description={`${item.name} inventory item`} />

      <section className={styles.inventory}>
        <Link href="/inventory">← Back to inventory</Link>
        <h3>{item.name}</h3>
        <p>
          Amount: {item.amount}{' '}
          {item.amount === 1 ? item.measure.singular : item.measure.plural}
        </p>
        <p className={expired ? styles.expired : ''}>
          Expires: {item.expiration}
          {expired && ' — expired'}
        </p>
      </section>
    </>
  );
}

export function getServerSideProps(context: GetServerSidePropsContext) {
  return { props: { uuid: context.params?.uuid } };
}
