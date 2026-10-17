import { Check, Clock3 } from "lucide-react";
import type { RecipeStep } from "@/types/recipe";
import type { CookingSession } from "@/lib/cooking-session";
import { RecipePhoto } from "@/components/recipe-details/recipe-photo";
import styles from "./cooking-mode.module.css";

export function CookingProgress({ steps, session, onNavigate, variant = "horizontal" }: { steps: RecipeStep[]; session: CookingSession; onNavigate: (index: number) => void; variant?: "horizontal" | "list" }) {
  return <nav className={variant === "list" ? styles.stepList : styles.progress} aria-label={variant === "list" ? "Всички стъпки" : "Напредък в готвенето"}>
    {variant === "list" && <h2>Стъпки <span>({steps.length})</span></h2>}
    <ol>{steps.map((step, index) => {
      const completed = session.completedSteps.includes(step.id);
      const current = index === session.currentStep;
      const available = index <= session.currentStep || completed;
      return <li key={step.id} className={`${completed ? styles.doneStep : ""} ${current ? styles.currentStep : ""}`}>
        <button type="button" disabled={!available || session.status !== "active"} aria-current={current ? "step" : undefined} aria-label={`Стъпка ${index + 1}: ${step.title}${completed ? ", завършена" : current ? ", текуща" : ", предстояща"}`} onClick={() => onNavigate(index)}>
          <span className={styles.stepDot} aria-hidden="true">{completed ? <Check size={18} /> : index + 1}</span>
          {variant === "list" && step.image && <span className={styles.stepThumbnail}><RecipePhoto visual={step.image} /></span>}
          <span className={styles.stepLabel}>{step.title}{variant === "list" && step.durationMinutes !== undefined && <small><Clock3 size={12} aria-hidden="true" />{step.durationMinutes} мин</small>}</span>
        </button>
      </li>;
    })}</ol>
  </nav>;
}
