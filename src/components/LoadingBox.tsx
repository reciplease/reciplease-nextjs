import Spinner from '@/components/Spinner';

export default function LoadingBox({
  label = 'Loading…',
  className = '',
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 p-4 ${className}`}>
      <Spinner label={label} />
    </div>
  );
}
