import Link from "next/link";
import { ArrowLeft, LogOut, Pause, Play, RotateCcw } from "lucide-react";
import type { ResolvedRecipe } from "@/types/recipe";
import type { CookingSession } from "@/lib/cooking-session";
import styles from "./cooking-mode.module.css";

export function CookingHeader({ recipe, session, onPause, onReset, onExit }: { recipe: ResolvedRecipe; session: CookingSession; onPause: () => void; onReset: () => void; onExit: () => void }) {
  const href = `/recipes/${recipe.id}`;
  return <header className={styles.header}>
    <Link href={href} className={styles.back} onClick={onExit}><ArrowLeft size={20} aria-hidden="true" /><span>Към рецептата</span></Link>
    <div className={styles.headerTitle}><h1>Готвим: {recipe.title}</h1><p>Стъпка {session.currentStep + 1} от {recipe.preparation!.steps.length} · {session.completedSteps.length} завършени · {session.servings} {session.servings === 1 ? "порция" : "порции"}</p></div>
    <div className={styles.headerControls}>
      <button type="button" onClick={onPause} aria-pressed={session.status === "paused"}>{session.status === "paused" ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}{session.status === "paused" ? "Продължи" : "Пауза"}</button>
      <button type="button" onClick={onReset} aria-label="Започни отначало" title="Започни отначало"><RotateCcw size={17} aria-hidden="true" /></button>
      <Link href={href} onClick={onExit} className={styles.exit}><LogOut size={17} aria-hidden="true" /><span>Изход</span></Link>
    </div>
  </header>;
}
