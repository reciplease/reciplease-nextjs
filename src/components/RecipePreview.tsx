import Link from "next/link";
import styles from "@/components/RecipePreview.module.scss";

interface Props {
  id: string;
  title: string;
  description: string;
}

export default function RecipePreview(props: Props) {
  return (
    <article className={styles.recipe_preview}>
      {/*TODO image?*/}
      <h4>{props.title}</h4>
      <p>{props.description}</p>
      <Link href={`/recipes/${props.id}`} passHref>
        <button>View recipe</button>
      </Link>
    </article>
  )
}