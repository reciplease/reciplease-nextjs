import ChefHat from '@/components/icons/ChefHat';

const HAT_DELAYS_MS = [0, 150, 300];

export default function Spinner({
  label = 'Loading…',
  size = 20,
  className = '',
}: {
  label?: string;
  size?: number;
  className?: string;
}) {
  return (
    <span role="status" className={`inline-flex items-center gap-2 ${className}`}>
      <span className="flex items-end gap-1" aria-hidden="true">
        {HAT_DELAYS_MS.map((delay) => (
          <ChefHat
            key={delay}
            size={size}
            className="animate-bounce text-secondary"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
      <span className="text-sm opacity-70">{label}</span>
    </span>
  );
}
