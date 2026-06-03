import styles from '@/components/Header.module.scss';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';

function Account() {
  const { data: session, status } = useSession();

  if (status !== 'authenticated') {
    return null;
  }

  return (
    <div className={styles.account}>
      {session.user?.email && (
        <span className={styles.email}>{session.user.email}</span>
      )}
      <button className={styles.signOut} onClick={() => signOut()}>
        Sign out
      </button>
    </div>
  );
}

export default function Header() {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>Reciplease</h1>
      <nav className={styles.navigation}>
        <Link href={'/recipes'}>Recipes</Link>
        <Link href={'/inventory'}>Inventory</Link>
        <Link href={'/planner'}>Planner</Link>
      </nav>
      <Account />
    </header>
  );
}
