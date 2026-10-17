import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import { formatCountdown, remainingTime, type TimerAction, type TimerState } from "@/lib/cooking-timer";
import styles from "./cooking-mode.module.css";

export function CookingTimer({ timer, now, disabled, onAction }: { timer: TimerState; now: number; disabled: boolean; onAction: (action: TimerAction) => void }) {
  const running = timer.status === "running";
  const completed = timer.status === "completed";
  return <div className={`${styles.timer} ${completed ? styles.timerCompleted : ""}`}>
    <div className={styles.countdown}><Timer size={25} aria-hidden="true" /><output role="timer" aria-label="Оставащо време" aria-live="off">{formatCountdown(remainingTime(timer, now))}</output></div>
    <button type="button" disabled={disabled || completed} onClick={() => onAction(running ? "pause" : timer.status === "paused" ? "resume" : "start")} aria-label={running ? "Пауза на таймера" : timer.status === "paused" ? "Продължи таймера" : "Старт на таймера"}>{running ? <Pause size={19} aria-hidden="true" /> : <Play size={19} aria-hidden="true" />}</button>
    <button type="button" onClick={() => onAction("reset")} aria-label="Нулирай таймера"><RotateCcw size={18} aria-hidden="true" /></button>
    <span className={styles.timerStatus} role="status">{completed ? "Таймерът приключи" : timer.status === "idle" ? "Натисни ▶ за старт" : timer.status === "paused" ? "На пауза" : "Таймерът работи"}</span>
  </div>;
}
