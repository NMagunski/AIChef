import Link from "next/link";
import { Check, ChefHat, Clock3, RotateCcw } from "lucide-react";
import type { ResolvedRecipe } from "@/types/recipe";
import type { CookingSession } from "@/lib/cooking-session";
import { RecipePhoto } from "@/components/recipe-details/recipe-photo";
import styles from "./cooking-mode.module.css";

export function CookingCompletion({ recipe, session, onRestart }: { recipe: ResolvedRecipe; session: CookingSession; onRestart: () => void }) {
  return <section className={styles.completion} aria-labelledby="completion-title">
    <div className={styles.completionPhoto} role="img" aria-label={recipe.title}><RecipePhoto visual={recipe.visual} /></div>
    <div className={styles.completionBody}><span className={styles.completionIcon}><ChefHat size={35} aria-hidden="true" /></span><p className={styles.stepEyebrow}>С щипка търпение и много вкус</p><h1 id="completion-title">Браво! Ястието е готово!</h1><h2>{recipe.title}</h2>
      <ul className={styles.completionStats}><li><Check size={18} aria-hidden="true" />{session.completedSteps.length} от {recipe.preparation!.steps.length} завършени стъпки</li><li><Clock3 size={18} aria-hidden="true" />Общо ориентировъчно време: {recipe.minutes === null ? "неуточнено" : `${recipe.minutes} мин`}</li></ul>
      <p className={styles.smallPrint}>Това е времето от рецептата, а не измерена продължителност на сесията.</p>
      <div className={styles.completionActions}><Link href={`/recipes/${recipe.id}`}>Обратно към рецептата</Link><button type="button" onClick={onRestart}><RotateCcw size={17} aria-hidden="true" />Приготви отново</button></div>
    </div>
  </section>;
}
