import styles from '@/components/Header.module.scss';
import Link from 'next/link';
import { useSession, signIn, signOut } from 'next-auth/react';

export default function Header() {
  const { data: session, status } = useSession();
  const authenticated = status === 'authenticated';

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>Reciplease</h1>
      {authenticated && (
        <nav className={styles.navigation}>
          <Link href={'/recipes'}>Recipes</Link>
          <Link href={'/inventory'}>Inventory</Link>
          <Link href={'/planner'}>Planner</Link>
        </nav>
      )}
      <div className={styles.account}>
        {authenticated ? (
          <>
            {session.user?.email && (
              <span className={styles.email}>{session.user.email}</span>
            )}
            <button className={styles.signOut} onClick={() => signOut()}>
              Sign out
            </button>
          </>
        ) : (
          <button className={styles.signOut} onClick={() => signIn('google')}>
            Sign in
          </button>
        )}
      </div>
    </header>
  );
}
