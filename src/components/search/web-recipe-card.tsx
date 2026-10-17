import { ExternalLink, Globe2 } from "lucide-react";
import type { WebRecipeResult } from "@/lib/web/types";
import { SearchRecipeCard } from "./search-recipe-card";
import { RecipePhoto } from "@/components/recipe-details/recipe-photo";
import styles from "./search-recipe-card.module.css";
export function WebRecipeCard({ result, compact = false }: { result: WebRecipeResult; compact?: boolean }) {
  if (result.access === "complete" && result.recipe) return <SearchRecipeCard recipe={result.recipe} compact={compact} />;
  return <article className={`${styles.card} ${styles.web} ${compact ? styles.compact : ""}`}>
    <a className={styles.photoLink} href={result.url} target="_blank" rel="noopener noreferrer" aria-label={`Отвори оригинала: ${result.title}`}><RecipePhoto visual={{ kind: "placeholder", name: "recipe" }} /></a>
    <span className={styles.sourceBadge}><Globe2 size={14} aria-hidden="true" />От интернет</span>
    <div className={styles.body}><h3><a href={result.url} target="_blank" rel="noopener noreferrer">{result.title}</a></h3>
      <p className={styles.description}>Връзка към оригинала · Пълният текст не се възпроизвежда в AIChef.</p>
      {result.limitations.map((message) => <p className={styles.description} key={message}>{message}</p>)}
      <a href={result.url} target="_blank" rel="noopener noreferrer" className={styles.recipeButton}>Отвори оригинала<ExternalLink size={17} aria-hidden="true" /></a>
      <p className={styles.sourceNote}>Източник: {result.sourceName} · {result.domain}</p>
    </div>
  </article>;
}
