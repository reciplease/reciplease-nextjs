import styles from '@/components/Header.module.scss';
import Link from 'next/link';

export default function Header() {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>Reciplease</h1>
      <nav className={styles.navigation}>
        <Link href={'/recipes'}>Recipes</Link>
        <Link href={'/inventory'}>Inventory</Link>
        <Link href={'/planner'}>Planner</Link>
      </nav>
    </header>
  );
}
