import Header from '@/components/Header';
import RecipeFab from '@/components/RecipeFab';
import InventoryFab from '@/components/InventoryFab';
import { Inter } from 'next/font/google';
import { useRouter } from 'next/router';
import styles from '@/components/Layout.module.scss';

const font = Inter({ subsets: ['latin'] });

// The inventory section recolours its accent to a darker green. Overriding the
// --color-highlight variable on the page wrapper cascades to everything that
// reads it: the nav's active underline, the FAB, focus rings, etc. (Tailwind 4
// utilities like bg-highlight resolve the variable at use, so they pick it up.)
const INVENTORY_HIGHLIGHT = '#2f6f4c';

export default function Layout({ children }: { children: JSX.Element }) {
  const { pathname } = useRouter();
  const onInventory = pathname.startsWith('/inventory');

  return (
    // The whole page is one content grid: the header breaks out to full width
    // while page content (main) sits in the centred reading column by default.
    <div
      className={`${font.className} content-grid`}
      style={
        onInventory
          ? ({ '--color-highlight': INVENTORY_HIGHLIGHT } as React.CSSProperties)
          : undefined
      }
    >
      <Header />
      <main className={styles.main}>{children}</main>
      {onInventory ? <InventoryFab /> : <RecipeFab />}
    </div>
  );
}
