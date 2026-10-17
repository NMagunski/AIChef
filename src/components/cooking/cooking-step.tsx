import { Thermometer } from "lucide-react";
import type { RecipeStep, ResolvedRecipe } from "@/types/recipe";
import type { TimerAction, TimerState } from "@/lib/cooking-timer";
import { RecipePhoto } from "@/components/recipe-details/recipe-photo";
import { CookingTimer } from "./cooking-timer";
import { CookingTips } from "./cooking-tips";
import styles from "./cooking-mode.module.css";

export function CookingStep({ recipe, step, index, timer, now, paused, onTimer, children }: { recipe: ResolvedRecipe; step: RecipeStep; index: number; timer?: TimerState; now: number; paused: boolean; onTimer: (action: TimerAction) => void; children: React.ReactNode }) {
  return <section className={styles.stepCard} aria-labelledby="current-step-title">
    <div className={styles.heroPhoto} role="img" aria-label={recipe.id === "pile-s-oriz" ? `Илюстрация: ${recipe.title}` : step.title}>
      {recipe.id === "pile-s-oriz" ? <svg className={styles.referencePhoto} viewBox="324 311 618 313" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><image href="/images/approved-cooking.png" width="1312" height="1199" /></svg> : <RecipePhoto visual={step.image ?? recipe.visual} />}
    </div>
    <div className={styles.stepBody}>
      <div className={styles.stepHeading}><div><p className={styles.stepEyebrow} role="status" aria-live="polite">Стъпка {index + 1} от {recipe.preparation!.steps.length}</p><h2 id="current-step-title" tabIndex={-1}>{step.title}</h2></div>{timer && <CookingTimer timer={timer} now={now} disabled={paused} onAction={onTimer} />}</div>
      <div className={styles.stepFacts}>{step.durationMinutes !== undefined && <span>Ориентировъчно: {step.durationMinutes} мин</span>}{step.temperatureC !== undefined && <span><Thermometer size={17} aria-hidden="true" />{step.temperatureC}°C</span>}</div>
      <div className={styles.descriptionRow}>{recipe.id === "pile-s-oriz" && step.image && <div className={styles.contextPhoto} role="img" aria-label={`Снимка към стъпката: ${step.title}`}><RecipePhoto visual={step.image} /></div>}<p className={styles.stepDescription}>{step.description}</p></div>
      {!timer && <p className={styles.noTimer}>Няма зададен таймер за тази стъпка.</p>}
      {step.tip && <CookingTips tips={[step.tip]} compact />}
      {children}
    </div>
  </section>;
}
