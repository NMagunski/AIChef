import { Sparkles } from "lucide-react";
import { CollapsibleSection } from "@/components/recipe-details/collapsible-section";
import styles from "./cooking-mode.module.css";

const questions = ["Мога ли да използвам пилешко филе?", "Как да стане по-сочно?", "Мога ли да приготвя това в мултикукър?", "Как да разбера дали е готово?"];

export function CookingAssistant() {
  return <CollapsibleSection id="cooking-assistant" title="AI помощник" icon={Sparkles} tint>
    <p className={styles.assistantNotice}>AI помощникът скоро ще бъде достъпен.</p>
    <p className={styles.assistantIntro}>Примерни въпроси за бъдещия помощник:</p>
    <ul className={styles.questions}>{questions.map((question) => <li key={question}>{question}</li>)}</ul>
    <p className={styles.smallPrint}>Демонстрационен панел без AI отговори.</p>
  </CollapsibleSection>;
}
