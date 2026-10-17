import type { ResolvedRecipe } from "@/types/recipe";
import { validateRecipe } from "@/lib/recipe-quality/validate-recipe";
import styles from "./recipe-quality-notice.module.css";
export function RecipeQualityNotice({ recipe }: { recipe: ResolvedRecipe }) {
  if (!recipe.source || recipe.source.mode === "demo") return null;
  const report = validateRecipe(recipe), warnings = report.issues.filter((i) => i.severity === "warning");
  if (!warnings.length) return null;
  return <details className={styles.notice}>
    <summary>Бележки за данните ({warnings.length})</summary>
    <ul>{warnings.map((warning, index) => <li key={`${warning.code}-${index}`}>{warning.message}</li>)}</ul>
    <p>Автоматичните проверки не гарантират безопасност и не заменят преценката при готвене.</p>
  </details>;
}
