import { issue, normalize, type QualityRecipe, type QualityOptions, type QualityIssue } from "./quality-types.ts";
import { foodGroups } from "./ingredients.ts";
export function constraintsFromQuery(query: string) {
  const q = normalize(query);
  const excluded = [...q.matchAll(/без\s+([^.!?;]+)/gu)].flatMap((m) => m[1].split(/,|\s+и\s+|\s+за\s+|\s+до\s+/u)).map((v) => v.trim()).filter((v) => v && !/^(?:фурна|котлон|лактоза|глутен|млечни|яйца|фъстъци)/u.test(v));
  const groups = new Set<string>();
  if (/вегетариан|веган/u.test(q)) ["poultry", "ground", "meat", "fish", "shellfish"].forEach((g) => groups.add(g));
  if (/веган/u.test(q)) ["dairy", "eggs", "honey"].forEach((g) => groups.add(g));
  if (/без\s+(?:млечни|мляко|лактоза)/u.test(q)) groups.add("dairy");
  if (/без\s+яйца/u.test(q)) groups.add("eggs");
  if (/без\s+фъст[ъу]ци/u.test(q)) groups.add("peanuts");
  if (/без\s*глутен/u.test(q)) groups.add("gluten");
  return { excluded, groups, allergyRelated: /без\s+(?:млечни|мляко|лактоза|яйца|фъст[ъу]ци)|без\s*глутен|алерг/u.test(q) };
}
export function validateDietary(recipe: QualityRecipe, options: QualityOptions): QualityIssue[] {
  const result: QualityIssue[] = [], constraints = constraintsFromQuery(options.query ?? "");
  const excluded = [...constraints.excluded, ...(options.excludedIngredients ?? [])].map(normalize);
  recipe.preparation.ingredients.forEach((ingredient, index) => {
    const name = normalize(ingredient.name), groups = foodGroups(name), field = `preparation.ingredients[${index}]`;
    const certifiedAlternative = /безглутен|без глутен/u.test(name);
    const conflict = groups.some((g) => constraints.groups.has(g) && !(g === "gluten" && certifiedAlternative));
    const directConflict = excluded.some((value) => {
      const excludedGroups = foodGroups(value);
      if (excludedGroups.length) return excludedGroups.some((g) => groups.includes(g));
      const stems = value.split(/[^\p{L}]+/u).filter((v) => v.length > 2).map((v) => v.slice(0, Math.max(3, v.length - 1)));
      return stems.length > 0 && stems.every((stem) => name.includes(stem));
    });
    if (conflict || directConflict) result.push(issue("DIETARY_CONFLICT", "error", `„${ingredient.name}“ противоречи на изрично хранително ограничение.`, field, "constraints"));
    if (constraints.groups.has("gluten") && !certifiedAlternative && /брашно|паста|макарон|овес|сос|бульон|галета/u.test(name) && !conflict) result.push(issue("UNCERTAIN_GLUTEN", "warning", "Съставът не доказва липса на глутен; провери етикета и възможното кръстосано замърсяване.", field, "constraints"));
    else if ((constraints.groups.size || excluded.length) && /сос|бульон|смес|готов|дресинг|маргарин|подправка за|вкус на/u.test(name) && !conflict && !directConflict) result.push(issue("UNKNOWN_COMPOSITION", "warning", "Провери състава на готовия продукт спрямо хранителните ограничения.", field, "constraints"));
  });
  if (constraints.allergyRelated) result.push(issue("ALLERGEN_VERIFICATION", "info", "Текстът на рецептата не удостоверява липса на алергени. Провери етикетите и кръстосаното замърсяване.", "preparation.ingredients", "constraints"));
  return result;
}
