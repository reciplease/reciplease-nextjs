import Header from '@/components/Header';
import RecipeFab from '@/components/RecipeFab';
import PantryFab from '@/components/PantryFab';
import PlannerFab from '@/components/PlannerFab';
import { Inter } from 'next/font/google';
import { useRouter } from 'next/router';
import type { JSX } from 'react';

const font = Inter({ subsets: ['latin'] });

// The pantry/planner sections recolour their accent (darker green / dark
// blue) via the shared .pantry-theme/.planner-theme classes (see
// main.scss), which override --color-highlight for everything beneath them:
// the nav's active underline, the FAB, focus rings, and Tailwind utilities
// like bg-highlight that resolve the variable at use.
export default function Layout({ children }: { children: JSX.Element }) {
  const { pathname } = useRouter();
  const onPantry = pathname.startsWith('/pantry');
  const onPlanner = pathname.startsWith('/planner');
  const sectionTheme = onPantry ? ' pantry-theme' : onPlanner ? ' planner-theme' : '';
  // The item detail page renders its own "log eaten" FAB (see EatFlow) at the
  // same fixed position — showing the section-wide "Scan item" FAB there too
  // would stack on top of it and hide it.
  const onPantryItemDetail = pathname === '/pantry/[uuid]';

  return (
    // The whole page is one content grid: the header breaks out to full width
    // while page content (main) sits in the centred reading column by default.
    <div className={`${font.className} content-grid${sectionTheme}`}>
      <Header />
      <main className='pt-4 pb-24'>{children}</main>
      {onPantryItemDetail ? null : onPantry ? <PantryFab /> : onPlanner ? <PlannerFab /> : <RecipeFab />}
    </div>
  );
}
