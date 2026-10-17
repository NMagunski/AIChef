import { issue, normalize, type QualityRecipe, type QualityIssue } from "./quality-types.ts";
import { foodGroups } from "./ingredients.ts";
/** Rounded Celsius home-cooking guidance, NOT pasteurization/time-temperature modelling.
 * Sources and scope: docs/FOOD_SAFETY_RULES.md. temperatureC is oven metadata. */
export const internalTemperatures = { poultry: 74, ground: 71, meat: 63, fish: 63, eggs: 71 } as const;
const internalFahrenheit = { poultry: 165, ground: 160, meat: 145, fish: 145, eggs: 160 } as const;
export function validateFoodSafety(recipe: QualityRecipe): QualityIssue[] {
  const result: QualityIssue[] = [], groups = new Set(recipe.preparation.ingredients.flatMap((i) => foodGroups(i.name)));
  const relevant = ["poultry", "ground", "meat", "fish", "shellfish", "eggs"].some((g) => groups.has(g));
  const perishable = relevant || groups.has("dairy");
  const instructions = recipe.preparation.steps.map((s, index) => ({ text: `${s.description} ${s.tip ?? ""}`, field: `preparation.steps[${index}]` }));
  // Tips from the source also constitute advice. Split sentences and clauses so generic
  // multi-food guidance cannot bind fish's threshold to chicken in a different clause.
  instructions.push(...recipe.preparation.tips.map((text, index) => ({ text, field: `preparation.tips[${index}]` })));
  let thermometer = false;
  for (const { text: raw, field } of instructions) for (const text of normalize(raw).split(/[;!?\n]+|\.(?!\d)/u)) {
    if (/термомет/u.test(text)) thermometer = true;
    const negated = /(?:^|\s)(?:не|никога не)\s+(?:сервирай|поднасяй|яж|ползвай|използвай|оставяй|съхранявай|размразявай)/u.test(text);
    if (negated) continue;
    if (groups.has("poultry") && /(?:сервирай|поднеси|яж|консумирай).{0,45}(?:суров|полусуров|недопечен).{0,25}(?:пиле|пилеш|пуеш)|(?:сервирай|поднеси).{0,25}(?:пиле|пилеш|пуеш).{0,25}(?:суров|полусуров|недопечен)/u.test(text)) result.push(issue("UNSAFE_RAW_POULTRY", "error", "Инструкциите препоръчват недоготвено птиче месо; рецептата не може да бъде показана като пълна.", field, "instructions"));
    if (relevant && /(?:сервирай|сложи|постави).{0,35}(?:сготвен|готов).{0,60}(?:неизмит|същата\s+(?:дъска|чиния)).{0,45}суров/u.test(text)) result.push(issue("RAW_MEAT_CROSS_CONTAMINATION", "error", "Инструкциите препоръчват контакт на готова храна със замърсен съд от сурови продукти.", field, "instructions"));
    if (relevant && /(?:размрази|размразявай).{0,50}(?:на плота|на стайна температура)/u.test(text)) result.push(issue("UNSAFE_THAWING", "error", "Инструкциите препоръчват размразяване на нетрайни продукти на стайна температура.", field, "instructions"));
    if ((perishable || (groups.has("rice") && /сготвен|сварен|варен|готов/u.test(text))) && /(?:остави|съхранявай).{0,100}(?:стайна температура|извън хладилника|на плота)/u.test(text)) {
      const hours = text.match(/(\d+(?:[.,]\d+)?)\s*час/u), minutes = text.match(/(\d+)\s*мин/u);
      const duration = hours ? Number(hours[1].replace(",", ".")) * 60 : minutes ? Number(minutes[1]) : /цяла нощ|през нощта/u.test(text) ? 480 : 0;
      if (duration > (/над\s*(?:32|90)\s*°/u.test(text) ? 60 : 120)) result.push(issue("UNSAFE_STORAGE", "error", "Инструкциите препоръчват прекалено дълго съхранение на нетрайна храна без охлаждане.", field, "instructions"));
    }
    // Only explicit INTERNAL targets, never an oven setting, ambient or cooling temperature.
    const target = text.match(/(?:вътрешн[а-я\s]{0,30}|в центъра.{0,15})(\d+(?:[.,]\d+)?)\s*°\s*([cfсф])/u);
    if (target && !/охлади|охлаждан|хладил|замраз/u.test(text)) {
      const amount = Number(target[1].replace(",", ".")), celsius = /f|ф/u.test(target[2]) ? (amount - 32) * 5 / 9 : amount;
      const explicit = foodGroups(text).filter((g) => g in internalTemperatures);
      const candidates = explicit.length ? explicit : Object.keys(internalTemperatures).filter((g) => groups.has(g));
      // Multiple unrelated foods and unclear scope => review, not a definite violation.
      if (candidates.includes("ground") && !candidates.includes("poultry")) { const meatIndex = candidates.indexOf("meat"); if (meatIndex >= 0) candidates.splice(meatIndex, 1); if (groups.has("poultry")) candidates.push("poultry"); }
      if (candidates.includes("poultry")) candidates.splice(0, candidates.length, "poultry");
      const targets = /f|ф/u.test(target[2]) ? internalFahrenheit : internalTemperatures;
      const thresholds = candidates.map((g) => targets[g as keyof typeof targets]);
      if (thresholds.length && amount < Math.min(...thresholds)) result.push(issue("UNSAFE_INTERNAL_TEMPERATURE", /междин|частичн|после|след това|продължи/u.test(text) ? "warning" : "error", "Посочената вътрешна температура е под приложимата препоръка за този продукт.", field, "instructions"));
      else if (thresholds.length > 1 && amount < Math.max(...thresholds)) result.push(issue("AMBIGUOUS_INTERNAL_TEMPERATURE", "warning", "Уточни за кой продукт се отнася вътрешната температура.", field, "instructions"));
      if (candidates.includes("meat") && !candidates.includes("ground") && celsius < 71 && !/3\s*мин|три\s+мин/u.test(text)) result.push(issue("WHOLE_CUT_REST", "warning", "За цели парчета месо провери и указанието за 3 минути почивка след достигане на препоръчаната температура.", field, "instructions"));
    }
    if (relevant && /(?:безопасн|готово е|напълно готов).{0,50}(?:само|единствено).{0,30}(?:цвят|цвет|розов|златист)|(?:само|единствено).{0,20}(?:цвят|цвет).{0,30}безопасн/u.test(text)) result.push(issue("VISUAL_DONENESS_ONLY", "warning", "Цветът сам по себе си не доказва безопасност; използвай подходяща проверка на вътрешната температура.", field, "instructions"));
  }
  if (relevant && !thermometer) result.push(issue("THERMOMETER_RECOMMENDED", "warning", "Провери приложимата вътрешна температура с кухненски термометър; видът на храната сам по себе си не е достатъчен.", "preparation.steps", "instructions"));
  if (groups.has("shellfish")) result.push(issue("SHELLFISH_GUIDANCE", "info", "При морски дарове провери конкретните насоки за вида продукт; няма един универсален температурен праг за всички видове.", "preparation.steps", "instructions"));
  return result;
}
