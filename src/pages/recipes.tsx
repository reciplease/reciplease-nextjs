import Head from 'next/head'
import {Inter} from 'next/font/google'
import Link from 'next/link'
import styles from '@/styles/5_pages/Recipes.module.scss'

const font = Inter({subsets: ['latin']})

export default function Recipes() {
  return (
    <>
      <Head>
        <title>Recipes</title>
        <meta name="description" content="View recipes"/>
      </Head>

      <div className={`${styles.root} ${font.className}`}>
        <header className={`${styles.header}`}>
          <h1 className={styles.title}>Reciplease</h1>
          <nav className={styles.navigation}>
            <Link href={"/recipes"}>
              Recipes
            </Link>
            <Link href={"/recipes"}>
              Inventory
            </Link>
            <Link href={"/recipes"}>
              Planner
            </Link>
          </nav>
        </header>
        <main>
          <section className={styles.recipes}>
            <h3 className={styles.recipes_title}>Recipes</h3>
            <ul className={styles.previews}>
              <li className={styles.recipe_preview}>
                <article>
                  {/*TODO image?*/}
                  <h4>Recipe 1</h4>
                  <p>A short description about the recipe</p>
                  <Link href="/recipes" passHref>
                    <button>View recipe</button>
                  </Link>
                </article>
              </li>
              <li className={styles.recipe_preview}>
                <article>
                  <h4>Recipe 2</h4>
                  <p>A short description about the recipe</p>
                  <Link href="/recipes" passHref>
                    <button>View recipe</button>
                  </Link>
                </article>
              </li>
              <li className={styles.recipe_preview}>
                <article>
                  <h4>Recipe 3</h4>
                  <p>A short description about the recipe</p>
                  <Link href="/recipes" passHref>
                    <button>View recipe</button>
                  </Link>
                </article>
              </li>
              <li className={styles.recipe_preview}>
                <article>
                  <h4>Recipe 4</h4>
                  <p>A short description about the recipe</p>
                  <Link href="/recipes" passHref>
                    <button>View recipe</button>
                  </Link>
                </article>
              </li>
            </ul>
          </section>
        </main>
      </div>
    </>
  )
}
