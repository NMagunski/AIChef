import { CheckCircle2, Lightbulb } from "lucide-react";
import { CollapsibleSection } from "./collapsible-section";
import styles from "./recipe-details.module.css";

export function CookingTips({ tips }: { tips: string[] }) {
  if (!tips.length) return null;
  return <CollapsibleSection id="tips" title="Съвети" icon={Lightbulb}><ul className={styles.tips}>{tips.map((tip) => <li key={tip}><CheckCircle2 size={17} aria-hidden="true" /><span>{tip}</span></li>)}</ul></CollapsibleSection>;
}
