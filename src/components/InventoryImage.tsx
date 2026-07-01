import { toDataUrl } from '@/lib/imageCapture';

// next/image optimizes network fetches; inventory photos are stored as inline
// base64 (see lib/imageCapture.ts) and embedded directly in the page/API
// response, so there's nothing left to optimize.
//
// Falls back to a placeholder tile when there's no image yet, so callers
// don't need their own `item.image && (...)` guard.
export default function InventoryImage({
  item,
  className,
}: {
  item: Pick<InventoryItem, 'image' | 'name'>;
  className: string;
}) {
  if (!item.image) {
    return (
      <div className={`${className} bg-[#f4f4f4] flex items-center justify-center text-2xl`}>
        🥫
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={toDataUrl(item.image)} alt={item.name} className={className} />;
}
