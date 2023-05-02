import Link from 'next/link';
import styles from '@/components/RecipePreview.module.scss';

interface Props {
  recipe: Recipe;
}

export default function RecipePreview({ recipe }: Props) {
  return (
    <article className={styles.recipe_preview}>
      {/*TODO image?*/}
      <h4>{recipe.name}</h4>
      <p>{recipe.description ?? 'No description found'}</p>
      <Link href={`/recipes/${recipe.recipeShortId}`} passHref>
        <button>View recipe</button>
      </Link>
    </article>
  );
}
