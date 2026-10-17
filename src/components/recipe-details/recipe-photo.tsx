import { UtensilsCrossed } from "lucide-react";
import type { RecipeVisual } from "@/types/recipe";
import { ReferencePhoto } from "@/components/ui/reference-photo";
import { SearchPhoto } from "@/components/search/search-photo";
import styles from "./recipe-details.module.css";

const crops = {
  rice: [40, 142, 377, 177], prepare: [371, 460, 90, 75],
  saute: [371, 560, 90, 81], chicken: [371, 681, 90, 79],
  addRice: [371, 788, 90, 77], liquid: [371, 896, 90, 54],
  oven: [371, 990, 90, 68], finish: [371, 1110, 90, 65],
} as const;

export function RecipePhoto({ visual }: { visual?: RecipeVisual }) {
  if (!visual || visual.kind === "placeholder") return <span className={styles.placeholderPhoto} role="img" aria-label="Снимката предстои"><UtensilsCrossed aria-hidden="true" /> Снимката предстои</span>;
  if (visual.kind === "home") return <ReferencePhoto name={visual.name} />;
  if (visual.kind === "search") return <SearchPhoto name={visual.name} />;
  return <svg aria-hidden="true" focusable="false" className={styles.referencePhoto} viewBox={crops[visual.name].join(" ")} preserveAspectRatio="xMidYMid slice"><image href="/images/approved-recipe.png" width="1312" height="1199" /></svg>;
}
