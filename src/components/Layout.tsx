import Header from '@/components/Header';
import { Inter } from 'next/font/google';

const font = Inter({ subsets: ['latin'] });

export default function Layout({ children }: { children: JSX.Element }) {
  return (
    <div className={font.className}>
      <Header />
      <main>{children}</main>
    </div>
  );
}
