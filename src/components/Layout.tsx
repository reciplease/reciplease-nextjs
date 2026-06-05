import Header from '@/components/Header';
import RecipeFab from '@/components/RecipeFab';
import { Inter } from 'next/font/google';
import styles from '@/components/Layout.module.scss';

const font = Inter({ subsets: ['latin'] });

export default function Layout({ children }: { children: JSX.Element }) {
  return (
    // The whole page is one content grid: the header breaks out to full width
    // while page content (main) sits in the centred reading column by default.
    <div className={`${font.className} content-grid`}>
      <Header />
      <main className={styles.main}>{children}</main>
      <RecipeFab />
    </div>
  );
}
