import { ClipboardCheck, Clock3, Thermometer } from "lucide-react";
import type { RecipeStep } from "@/types/recipe";
import { CollapsibleSection } from "./collapsible-section";
import { RecipePhoto } from "./recipe-photo";
import styles from "./recipe-details.module.css";

export function RecipeInstructions({ steps }: { steps: RecipeStep[] }) {
  return <CollapsibleSection id="instructions" title="Начин на приготвяне" icon={ClipboardCheck}>
    <ol className={styles.steps}>{steps.map((step, index) => <li key={step.id}>
      <span className={styles.stepNumber} aria-hidden="true">{index + 1}</span>
      {step.image && <div className={styles.stepPhoto}><RecipePhoto visual={step.image} /></div>}
      <div className={styles.stepText}><h3>{step.title}</h3><p>{step.description}</p>
        <div className={styles.stepMetadata}>
          {step.durationMinutes !== undefined && <span><Clock3 size={15} aria-hidden="true" />{step.durationMinutes} мин</span>}
          {step.temperatureC !== undefined && <span><Thermometer size={15} aria-hidden="true" />{step.temperatureC}°C</span>}
        </div>
      </div>
    </li>)}</ol>
  </CollapsibleSection>;
}
