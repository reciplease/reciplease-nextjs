import useSWR from 'swr';
import { GetServerSidePropsContext } from 'next';
import Link from 'next/link';
import Metadata from '@/components/Metadata';
import { formatTimestamp } from '@/lib/formatDate';
import { toDataUrl } from '@/lib/imageCapture';

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
        <p>Loading...</p>
      </>
    );
  }

  if (error || !item) {
    return (
      <>
        <Metadata title="Not Found" description="Inventory item not found" />
        <p>Item not found</p>
        <Link href="/inventory">Back to inventory</Link>
      </>
    );
  }

  const expired = isExpired(item.expiration);

  return (
    <>
      <Metadata title={item.name} description={`${item.name} inventory item`} />

      <section className="grid gap-3">
        <Link href="/inventory" className="text-sm">← Back to inventory</Link>
        {item.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={toDataUrl(item.image)}
            alt=""
            className="w-32 h-32 object-cover rounded-lg border border-[#ccc]"
          />
        )}
        <h3 className="text-xl font-semibold">{item.name}</h3>
        <p>
          Amount: {item.amount}{' '}
          {item.amount === 1 ? item.measure.singular : item.measure.plural}
        </p>
        <p className={expired ? 'opacity-60' : ''}>
          Expires: {item.expiration}
          {expired && ' — expired'}
        </p>
        {item.barcode && (
          <p className="text-sm text-[#666]">Barcode: {item.barcode}</p>
        )}
        {item.updatedAt && (
          <p className="text-sm text-[#666]">
            Last updated: {formatTimestamp(item.updatedAt)}
          </p>
        )}
      </section>
    </>
  );
}

export function getServerSideProps(context: GetServerSidePropsContext) {
  return { props: { uuid: context.params?.uuid } };
}
