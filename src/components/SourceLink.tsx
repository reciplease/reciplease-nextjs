import useSWR from 'swr';
import LoadingBox from '@/components/LoadingBox';
import type { LinkPreview, RecipeMeta } from '@/lib/link-preview';

const fetcher = async (url: string): Promise<LinkPreview> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to load link preview');
  return res.json();
};

function formatRecipeMetaLine(meta: RecipeMeta): string {
  const rating = meta.rating
    ? `★${meta.rating.value}${meta.rating.count ? ` (${meta.rating.count.toLocaleString()})` : ''}`
    : null;
  return [meta.time, meta.servings, rating].filter(Boolean).join(' · ');
}

const CARD_BASE_CLASSNAME = 'mb-4 flex items-center gap-3 rounded-lg border-2 p-2';
const CARD_CLASSNAME = `${CARD_BASE_CLASSNAME} border-secondary transition-colors hover:bg-secondary hover:text-white`;

export default function SourceLink({ url }: { url: string }) {
  const { data, error } = useSWR(`/api/link-preview?url=${encodeURIComponent(url)}`, fetcher);

  if (error) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-[#666] hover:underline truncate block mb-4"
      >
        Source: {url}
      </a>
    );
  }

  if (!data) {
    return <LoadingBox label="Loading preview…" className="mb-4 min-h-16" />;
  }

  if (data.type === 'youtube') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className={CARD_CLASSNAME}>
        {data.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.thumbnailUrl} alt="" className="h-12 w-20 shrink-0 rounded object-cover" />
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{data.title ?? url}</span>
          <span className="block truncate text-xs opacity-70">
            {data.channelName ? `${data.channelName} · YouTube` : 'YouTube'}
          </span>
        </span>
      </a>
    );
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={CARD_CLASSNAME}>
      {data.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data.image} alt="" className="h-12 w-20 shrink-0 rounded object-cover" />
      )}
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{data.title ?? data.siteName}</span>
        <span className="block truncate text-xs opacity-70">{data.siteName}</span>
        {data.recipeMeta && (
          <span className="block truncate text-xs opacity-70">{formatRecipeMetaLine(data.recipeMeta)}</span>
        )}
      </span>
    </a>
  );
}
