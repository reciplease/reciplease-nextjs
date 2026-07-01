import { toDataUrl } from '@/lib/imageCapture';

// next/image optimizes network fetches; inventory photos are stored as inline
// base64 (see lib/imageCapture.ts) and embedded directly in the page/API
// response, so there's nothing left to optimize.
//
// Renders nothing when there's no image yet (unless showPlaceholder is set),
// so callers don't need their own `item.image && (...)` guard.
export default function InventoryImage({
  item,
  className,
  showPlaceholder = false,
}: {
  item: Pick<InventoryItem, 'image' | 'name'>;
  className: string;
  showPlaceholder?: boolean;
}) {
  if (!item.image) {
    if (!showPlaceholder) return null;
    return (
      <div className={`${className} bg-[#f4f4f4] flex items-center justify-center text-2xl`}>
        🥫
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={toDataUrl(item.image)} alt={item.name} className={className} />;
}
