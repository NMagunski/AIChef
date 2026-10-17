import { Minus, Plus } from "lucide-react";
import { maximumServings, minimumServings } from "@/lib/servings";
import styles from "./recipe-details.module.css";

export function ServingsControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <div className={styles.servingsControl} role="group" aria-label="Брой порции">
    <button type="button" disabled={value <= minimumServings} onClick={() => onChange(value - 1)} aria-label="Намали порциите"><Minus size={17} aria-hidden="true" /></button>
    <output aria-live="polite" aria-atomic="true">{value} <span>{value === 1 ? "порция" : "порции"}</span></output>
    <button type="button" disabled={value >= maximumServings} onClick={() => onChange(value + 1)} aria-label="Увеличи порциите"><Plus size={17} aria-hidden="true" /></button>
  </div>;
}
