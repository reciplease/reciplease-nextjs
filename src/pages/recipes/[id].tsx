import { useRouter } from 'next/router';
import Metadata from '@/components/Metadata';
import styles from '@/pages/recipes/Recipe.module.scss';

const example_description: string =
  'Lorem ipsum dolor sit amet, consectetur adipisicing elit. Blanditiis commodi dolore dolorem dolores eveniet facilis fugit, libero magnam maxime nesciunt nisi non nostrum perferendis placeat ratione rerum sunt vero voluptatem!';

type Ingredient = {
  ingredientId: string;
  name: string;
  measure: string;
  amount: number;
};

type Recipe = {
  recipeId: string;
  name: string;
  description: string;
  ingredients: Ingredient[];
};

const exampleRecipe: Recipe = {
  recipeId: 'dbdc02be-a311-4aee-b974-c88d3c61f51b',
  name: 'Toast',
  description: example_description,
  ingredients: [
    {
      ingredientId: 'c2dc1ad1-f6f9-467a-a0f3-51a5ca6406df',
      name: 'bread',
      measure: 'ITEMS',
      amount: 1,
    },
    {
      ingredientId: '1363607e-c4c3-41a1-a475-feb138a69196',
      name: 'butter',
      measure: 'GRAMS',
      amount: 15,
    },
  ],
};

export default function Recipe() {
  const router = useRouter();
  const { id } = router.query;

  if (id !== exampleRecipe.recipeId) {
    return (
      <>
        <Metadata title={'No Recipe Found'} description={'No recipe found'} />

        <section className={styles.recipe}>
          <p>No recipe found</p>
        </section>
      </>
    );
  }

  return (
    <>
      <Metadata title={`${exampleRecipe.name}`} description={'View recipe'} />

      <section className={styles.recipe}>
        <h3>Recipe: {exampleRecipe.name}</h3>
        <p>{exampleRecipe.description}</p>
        <h4>Ingredients</h4>
        <ul>
          {exampleRecipe.ingredients.map((ingredient) => (
            <li key={ingredient.ingredientId}>
              {ingredient.name}
              {' - '}
              {ingredient.amount} {ingredient.measure.toLowerCase()}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
