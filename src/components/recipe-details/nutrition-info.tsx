import { ChartNoAxesCombined } from "lucide-react";
import type { RecipeNutrition } from "@/types/recipe";
import { CollapsibleSection } from "./collapsible-section";
import styles from "./recipe-details.module.css";

export function NutritionInfo({ nutrition }: { nutrition?: RecipeNutrition }) {
  if (!nutrition) return null;
  const items = [
    { label: "Калории", value: nutrition.calories, unit: "ккал" },
    { label: "Протеини", value: nutrition.proteinGrams, unit: "г" },
    { label: "Въглехидрати", value: nutrition.carbohydrateGrams, unit: "г" },
    { label: "Мазнини", value: nutrition.fatGrams, unit: "г" },
    { label: "Фибри", value: nutrition.fiberGrams, unit: "г" },
  ].filter((item) => item.value !== undefined && Number.isFinite(item.value) && item.value! >= 0);
  if (!items.length) return null;
  return <CollapsibleSection id="nutrition" title="Хранителна информация" icon={ChartNoAxesCombined}><p className={styles.nutritionBasis}>{nutrition.basis}</p><dl className={styles.nutritionGrid}>{items.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value!.toLocaleString("bg-BG")} {item.unit}</dd></div>)}</dl></CollapsibleSection>;
}
