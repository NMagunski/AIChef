import { ChefHat, Lightbulb } from "lucide-react";
import { CollapsibleSection } from "@/components/recipe-details/collapsible-section";
import styles from "./cooking-mode.module.css";

export function CookingTips({ tips, compact = false }: { tips: string[]; compact?: boolean }) {
  if (!tips.length) return null;
  if (compact) return <aside className={styles.tip}><ChefHat size={30} aria-hidden="true" /><div><h3>Съвет от рецептата</h3><p>{tips[0]}</p></div></aside>;
  return <CollapsibleSection id="cooking-tips" title="Полезни съвети" icon={Lightbulb}><ul className={styles.tips}>{tips.map((tip) => <li key={tip}>{tip}</li>)}</ul></CollapsibleSection>;
}
