"use client";

import { ClipboardList } from "lucide-react";
import type { Ingredient } from "@/types/recipe";
import { formatIngredientAmount, scaleIngredients } from "@/lib/servings";
import { ServingsControl } from "./servings-control";
import { CollapsibleSection } from "./collapsible-section";
import styles from "./recipe-details.module.css";

export function IngredientList({ ingredients, baseServings, servings, onServingsChange, checked, onCheck }: { ingredients: Ingredient[]; baseServings: number; servings: number; onServingsChange: (value: number) => void; checked: string[]; onCheck: (id: string) => void }) {
  const scaled = scaleIngredients(ingredients, baseServings, servings);
  return (
    <CollapsibleSection id="ingredients" title="Продукти" icon={ClipboardList} defaultOpen action={<ServingsControl value={servings} onChange={onServingsChange} />}>
      <ul className={styles.ingredients}>
        {scaled.map((ingredient) => <li key={ingredient.id} className={checked.includes(ingredient.id) ? styles.checkedIngredient : ""}>
          <label>
            <input type="checkbox" checked={checked.includes(ingredient.id)} onChange={() => onCheck(ingredient.id)} />
            <span className={styles.ingredientIcon} aria-hidden="true">{ingredient.icon ?? "🥣"}</span>
            <span className={styles.ingredientName}>{ingredient.name}{ingredient.availability === "additional" ? " · необходимо допълнително" : ingredient.availability === "available" ? " · налично според заявката" : ""}{ingredient.quantity !== null && ingredient.note && <small>{ingredient.note}</small>}</span>
            <span className={styles.ingredientAmount}>{formatIngredientAmount(ingredient)}</span>
          </label>
        </li>)}
      </ul>
      <p className={styles.ingredientHint}>{checked.length}/{ingredients.length} подготвени · Количествата са за {servings} {servings === 1 ? "порция" : "порции"}. Отбележи продуктите, които вече си подготвил.</p>
    </CollapsibleSection>
  );
}
