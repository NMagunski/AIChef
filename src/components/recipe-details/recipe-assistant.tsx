import { Sparkles } from "lucide-react";
import { CollapsibleSection } from "./collapsible-section";
import styles from "./recipe-details.module.css";

const questions = ["Мога ли да заменя ориза с кафяв ориз?", "Как да я направя по-здравословна?", "Може ли в тенджера вместо във фурна?", "Как да я направя за 6 порции?"];

export function RecipeAssistant() {
  return <CollapsibleSection id="assistant" title="AI помощник" icon={Sparkles} tint>
    <span className={styles.comingSoon}>Очаквай скоро</span>
    <p className={styles.assistantIntro}>Помощникът все още не е активен. Примерни въпроси:</p>
    <ul className={styles.questions}>{questions.map((question) => <li key={question}>{question}</li>)}</ul>
    <p className={styles.assistantNote}>Тук няма AI отговори или връзка с външна услуга.</p>
  </CollapsibleSection>;
}
