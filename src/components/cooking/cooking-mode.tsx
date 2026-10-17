"use client";

import { CheckCircle2, Pause, X } from "lucide-react";
import type { ResolvedRecipe } from "@/types/recipe";
import { useCookingSession } from "@/hooks/use-cooking-session";
import { CookingHeader } from "./cooking-header";
import { CookingProgress } from "./cooking-progress";
import { CookingStep } from "./cooking-step";
import { CookingNavigation } from "./cooking-navigation";
import { CookingIngredients } from "./cooking-ingredients";
import { CookingTips } from "./cooking-tips";
import { CookingAssistant } from "./cooking-assistant";
import { CookingCompletion } from "./cooking-completion";
import styles from "./cooking-mode.module.css";

export function CookingMode({ recipe, preferredServings }: { recipe: ResolvedRecipe; preferredServings?: number }) {
  const { session, now, notice, storageAvailable, dispatch, flush, dismissNotice } = useCookingSession(recipe, preferredServings);
  if (!session) return <div data-cooking className={styles.loading}><h1>Готвим: {recipe.title}</h1><p role="status" aria-live="polite">Възстановяваме локалната сесия…</p><div className={styles.loadingPhoto} aria-hidden="true" /></div>;
  const preparation = recipe.preparation!;
  const step = preparation.steps[session.currentStep];
  const paused = session.status === "paused";
  const completedTimers = preparation.steps.filter((item) => session.timers[item.id]?.status === "completed");
  const navigate = (index: number) => dispatch({ type: "go", index });

  return <div data-cooking className={styles.page}>
    {notice && <div className={styles.notice} role="status"><span>{notice}</span><button type="button" onClick={dismissNotice} aria-label="Затвори съобщението"><X size={17} aria-hidden="true" /></button></div>}
    {session.status === "completed" ? <CookingCompletion recipe={recipe} session={session} onRestart={() => dispatch({ type: "reset" })} /> : <>
      <CookingHeader recipe={recipe} session={session} onPause={() => dispatch({ type: paused ? "resume" : "pause" })} onReset={() => dispatch({ type: "reset" })} onExit={flush} />
      {paused && <div className={styles.pausedBanner} role="status"><Pause size={18} aria-hidden="true" /><span>Сесията и активните таймери са на пауза.</span><button type="button" onClick={() => dispatch({ type: "resume" })}>Продължи</button></div>}
      {completedTimers.map((item) => <div className={styles.timerNotice} role="status" key={item.id}><CheckCircle2 size={21} aria-hidden="true" /><span>Таймерът за „{item.title}“ приключи.</span><button type="button" onClick={() => dispatch({ type: "timer", id: item.id, action: "reset" })}>Нулирай</button></div>)}
      <CookingProgress steps={preparation.steps} session={session} onNavigate={navigate} />
      <div className={styles.layout}>
        <aside className={styles.sidebar} aria-label="Стъпки и продукти"><div className={styles.desktopSteps}><CookingProgress steps={preparation.steps} session={session} onNavigate={navigate} variant="list" /></div><CookingIngredients ingredients={preparation.ingredients} checked={session.checkedIngredients} baseServings={recipe.servings} servings={session.servings} onCheck={(id) => dispatch({ type: "check", id })} /></aside>
        <div className={styles.mainArea}>
          <CookingStep recipe={recipe} step={step} index={session.currentStep} timer={session.timers[step.id]} now={now} paused={paused} onTimer={(action) => dispatch({ type: "timer", id: step.id, action })}>
            <CookingNavigation first={session.currentStep === 0} last={session.currentStep === preparation.steps.length - 1} disabled={paused} onPrevious={() => dispatch({ type: "previous" })} onNext={() => dispatch({ type: "next" })} />
          </CookingStep>
        </div>
        <div className={styles.extras}><CookingTips tips={preparation.tips} /><CookingAssistant /></div>
      </div>
      <p className={styles.persistenceNote}>{storageAvailable ? "Прогресът се запазва на това устройство. Активните таймери продължават при смяна на стъпка или изход." : "Прогресът не може да бъде запазен на това устройство."} {recipe.source?.kind === "ai" && recipe.source.mode === "live" ? `${recipe.source.discoveryType === "ai_alternative" ? "AI алтернатива" : "AI генерирана рецепта"} · не е професионално проверена.` : recipe.source?.kind === "web" && recipe.source.mode === "live" ? `Източник: ${recipe.source.name}.` : "Демо рецепта."}</p>
    </>}
  </div>;
}
