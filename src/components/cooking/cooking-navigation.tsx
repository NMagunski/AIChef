import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import styles from "./cooking-mode.module.css";

export function CookingNavigation({ first, last, disabled, onPrevious, onNext }: { first: boolean; last: boolean; disabled: boolean; onPrevious: () => void; onNext: () => void }) {
  return <div className={styles.navigation}>
    <button type="button" disabled={first || disabled} onClick={onPrevious} className={styles.previous}><ArrowLeft size={19} aria-hidden="true" /><span>Предишна<span className={styles.desktopWord}> стъпка</span></span></button>
    <button type="button" disabled={disabled} onClick={onNext} className={styles.next}>{last ? <>Завърши готвенето<Check size={19} aria-hidden="true" /></> : <><span><span className={styles.desktopWord}>Готово, </span>следваща<span className={styles.desktopWord}> стъпка</span></span><ArrowRight size={19} aria-hidden="true" /></>}</button>
  </div>;
}
