import { safetySource } from "@/lib/ai/recipe-schema";
import { ExternalLink, Globe2, Link2, Sparkles, Utensils } from "lucide-react";
import type { RecipeSource as Source } from "@/types/recipe";
import { CollapsibleSection } from "./collapsible-section";
import styles from "./recipe-details.module.css";

function validSourceUrl(source?: Source) {
  if (source?.kind !== "web" || source.mode !== "live" || !source.name.trim()) return undefined;
  try { const url = new URL(source.url); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : undefined; } catch { return undefined; }
}

export function RecipeSource({ source, badge = false }: { source?: Source; badge?: boolean }) {
  const demo = !source || source.mode === "demo";
  const url = validSourceUrl(source);
  const Icon = source?.kind === "ai" ? Sparkles : source?.kind === "web" ? Globe2 : Utensils;
  const label = demo ? "Демо рецепта" : source?.kind === "ai" ? source.discoveryType === "ai_alternative" ? "AI алтернатива" : "AI генерирана рецепта" : "Рецепта от интернет";
  if (badge) return <span className={`${styles.sourceBadge} ${source?.kind === "web" ? styles.webBadge : source?.kind === "ai" && source.discoveryType === "ai_alternative" ? styles.alternativeBadge : ""}`}><Icon size={14} aria-hidden="true" />{label}{demo && source ? ` · ${source.kind === "ai" ? "AI" : "Web"} пример` : ""}</span>;
  return <CollapsibleSection id="source" title="Източник" icon={Link2}>
    <p className={styles.sourceLabel}><Icon size={17} aria-hidden="true" />{label}</p>
    {source?.kind === "ai" && source.mode === "live" && <p className={styles.sourceDescription}>{source.discoveryType === "ai_alternative" ? "Независима AI алтернатива по твоята заявка; не е рецепта от външен сайт." : "Генерирана с OpenAI."} Форматът и основни ограничения са проверени автоматично; рецептата не е професионално проверена. <a href={safetySource} target="_blank" rel="noopener noreferrer">Насоки за безопасни вътрешни температури (USDA)</a></p>}
    {source?.kind === "web" && source.mode === "live" && source.reuse?.contentPermission === "authorized" && <p className={styles.sourceDescription}>Възпроизвеждане с документирано разрешение: {source.reuse.licenseReference}. Оригиналният текст е запазен; хранителна и кулинарна проверка не е извършена.</p>}
    {demo ? <p className={styles.sourceDescription}>Локални примерни данни за демонстрация на приложението. Рецептата не е генерирана с AI и няма реален интернет източник. Инструкциите са илюстративни.</p> : url && source?.kind === "web" && source.mode === "live" ? <a href={url} target="_blank" rel="noopener noreferrer" className={styles.sourceLink}>{source.name}<ExternalLink size={15} aria-hidden="true" /></a> : source?.kind === "web" ? <p className={styles.sourceDescription}>Няма валиден адрес на оригиналния източник.</p> : null}
  </CollapsibleSection>;
}
