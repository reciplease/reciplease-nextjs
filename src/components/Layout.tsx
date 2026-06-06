import Header from '@/components/Header';
import RecipeFab from '@/components/RecipeFab';
import InventoryFab from '@/components/InventoryFab';
import { Inter } from 'next/font/google';
import { useRouter } from 'next/router';
import styles from '@/components/Layout.module.scss';

const font = Inter({ subsets: ['latin'] });

// The inventory section recolours its accent to a darker green via the shared
// .inventory-theme class (see main.scss), which overrides --color-highlight for
// everything beneath it: the nav's active underline, the FAB, focus rings, and
// Tailwind utilities like bg-highlight that resolve the variable at use.
export default function Layout({ children }: { children: JSX.Element }) {
  const { pathname } = useRouter();
  const onInventory = pathname.startsWith('/inventory');

  return (
    // The whole page is one content grid: the header breaks out to full width
    // while page content (main) sits in the centred reading column by default.
    <div
      className={`${font.className} content-grid${onInventory ? ' inventory-theme' : ''}`}
    >
      <Header />
      <main className={styles.main}>{children}</main>
      {onInventory ? <InventoryFab /> : <RecipeFab />}
    </div>
  );
}
