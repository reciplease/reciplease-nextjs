import Header from '@/components/Header';
import { Inter } from 'next/font/google';
import styles from '@/components/Layout.module.scss';

const font = Inter({ subsets: ['latin'] });

export default function Layout({ children }: { children: JSX.Element }) {
  return (
    <div className={font.className}>
      <Header />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
