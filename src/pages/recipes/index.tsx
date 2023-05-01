import styles from '@/pages/recipes/Recipes.module.scss';
import RecipePreview from '@/components/RecipePreview';
import Metadata from '@/components/Metadata';

const example_description: string =
  'Lorem ipsum dolor sit amet, consectetur adipisicing elit. Blanditiis commodi dolore dolorem dolores eveniet facilis fugit, libero magnam maxime nesciunt nisi non nostrum perferendis placeat ratione rerum sunt vero voluptatem!';

export default function Recipes() {
  return (
    <>
      <Metadata title={'Recipes'} description={'View recipes'} />

      <section className={styles.recipes}>
        <h3 className={styles.recipes_title}>Recipes</h3>
        <ul className={styles.previews}>
          {[1, 2, 3, 'dbdc02be-a311-4aee-b974-c88d3c61f51b'].map((i) => (
            <li key={i}>
              <RecipePreview
                id={`${i}`}
                title={`Recipe ${i}`}
                description={example_description}
              />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
