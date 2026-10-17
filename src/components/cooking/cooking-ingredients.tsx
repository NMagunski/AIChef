import { ClipboardList } from "lucide-react";
import type { Ingredient } from "@/types/recipe";
import { formatIngredientAmount, scaleIngredients } from "@/lib/servings";
import { CollapsibleSection } from "@/components/recipe-details/collapsible-section";
import styles from "./cooking-mode.module.css";

export function CookingIngredients({ ingredients, checked, baseServings, servings, onCheck }: { ingredients: Ingredient[]; checked: string[]; baseServings: number; servings: number; onCheck: (id: string) => void }) {
  const scaled = scaleIngredients(ingredients, baseServings, servings);
  return <CollapsibleSection id="cooking-ingredients" title="Продукти" icon={ClipboardList} action={<span className={styles.ingredientCount} aria-live="polite">{checked.length}/{ingredients.length}</span>}>
    <p className={styles.smallPrint}>За {servings} {servings === 1 ? "порция" : "порции"} · отметките се запазват локално.</p>
    <ul className={styles.ingredients}>{scaled.map((ingredient) => <li key={ingredient.id} className={checked.includes(ingredient.id) ? styles.checked : ""}>
      <label><input type="checkbox" checked={checked.includes(ingredient.id)} onChange={() => onCheck(ingredient.id)} /><span className={styles.ingredientEmoji} aria-hidden="true">{ingredient.icon ?? "🥣"}</span><span className={styles.ingredientName}>{ingredient.name}{ingredient.availability === "additional" ? " · необходимо допълнително" : ingredient.availability === "available" ? " · налично според заявката" : ""}</span><span className={styles.amount}>{formatIngredientAmount(ingredient)}</span></label>
    </li>)}</ul>
  </CollapsibleSection>;
}
