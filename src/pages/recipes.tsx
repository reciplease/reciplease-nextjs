import Head from 'next/head'
import {Inter} from 'next/font/google'
import styles from '@/pages/Recipes.module.scss'
import Header from "@/components/Header";
import RecipePreview from "@/components/RecipePreview";

const font = Inter({subsets: ['latin']})

const example_description: string = "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Blanditiis commodi dolore dolorem dolores eveniet facilis fugit, libero magnam maxime nesciunt nisi non nostrum perferendis placeat ratione rerum sunt vero voluptatem!"

export default function Recipes() {
  return (
    <>
      <Head>
        <title>Recipes</title>
        <meta name="description" content="View recipes"/>
      </Head>

      <div className={`${styles.root} ${font.className}`}>
        <Header/>
        <main>
          <section className={styles.recipes}>
            <h3 className={styles.recipes_title}>Recipes</h3>
            <ul className={styles.previews}>
              {[1, 2, 3, 4].map(i => <li key={i}><RecipePreview title={`Recipe ${i}`} description={example_description}/></li>)}
            </ul>
          </section>
        </main>
      </div>
    </>
  )
}
