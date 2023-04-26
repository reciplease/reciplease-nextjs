import Head from 'next/head'
import {Inter} from 'next/font/google'
import styles from '@/styles/Index.module.scss'

const inter = Inter({subsets: ['latin']})

export default function Index() {
  return (
    <>
      <Head>
        <title>Recipes</title>
        <meta name="description" content="View recipes"/>
      </Head>
      <div className={`${styles.wrapper} ${inter.className}`}>
        <header className={styles.title}>
          <h1>Reciplease</h1>
        </header>
        <main>
        </main>
      </div>
    </>
  )
}
