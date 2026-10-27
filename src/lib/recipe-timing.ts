type RecipeTiming = {
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  servings?: number | null;
};

function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

export function describeTiming({ prepTimeMinutes, cookTimeMinutes, servings }: RecipeTiming): string[] {
  const parts: string[] = [];
  if (prepTimeMinutes != null) parts.push(`Prep ${formatMinutes(prepTimeMinutes)}`);
  if (cookTimeMinutes != null) parts.push(`Cook ${formatMinutes(cookTimeMinutes)}`);
  if (servings != null) parts.push(`Serves ${servings}`);
  return parts;
}
