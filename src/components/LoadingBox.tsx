import Spinner from '@/components/Spinner';

export default function LoadingBox({
  label = 'Loading…',
  className = '',
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100 p-4 ${className}`}>
      <Spinner label={label} />
    </div>
  );
}
