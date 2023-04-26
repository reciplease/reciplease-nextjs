import Head from 'next/head'
import {Inter} from 'next/font/google'
import styles from '@/styles/Home.module.css'

const inter = Inter({subsets: ['latin']})

export default function Index() {
  return (
    <>
      <Head>
        <title>Recipes</title>
        <meta name="description" content="View recipes"/>
      </Head>
      <main className={`${inter.className}`}>
        <h1>Reciplease</h1>
      </main>
    </>
  )
}
