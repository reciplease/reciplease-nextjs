import Fab from '@/components/Fab';

// FAB for the recipes section: opens the recipe builder.
export default function RecipeFab() {
  return <Fab href="/recipes/new" label="New recipe" />;
}
