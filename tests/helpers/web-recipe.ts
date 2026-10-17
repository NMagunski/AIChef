import { normalizeSerpResponse } from "../../src/lib/server/web/serpapi.ts";
import { extractRecipe, normalizeAuthorizedRecipe } from "../../src/lib/web/extract.ts";
import { classifyPermission, type AuthorizedSource } from "../../src/lib/web/permissions.ts";
import type { WebRecipeResult } from "../../src/lib/web/types.ts";
/** Synthetic test content/permission only. Never add this to the production registry. */
export const testSource: AuthorizedSource = { origin: "https://recipes.example.org", pathPrefix: "/recipes", sourceName: "Синтетичен тестов източник", licenseReference: "Synthetic test permission — not a real publisher license", evidenceReference: "tests/helpers/web-recipe.ts", attributionRequired: true, imageReuseAllowed: false, reviewedAt: "2020-01-01T00:00:00.000Z", expiresAt: null };
export const structuredRecipe = { "@context": "https://schema.org", "@type": "Recipe", name: "Тестово пиле с ориз", description: "Синтетична рецепта само за автоматизирани тестове.", recipeIngredient: ["300 г ориз", "½ ч.л. сол", "черен пипер на вкус"], recipeInstructions: [{ "@type": "HowToSection", name: "Подготовка", itemListElement: [{ "@type": "HowToStep", name: "Подготви ориза", text: "Измери тестовите продукти." }] }, { "@type": "HowToStep", name: "Завърши теста", text: "Тази стъпка е само тестови текст, не кулинарни указания.", duration: "PT1M" }], prepTime: "PT10M", cookTime: "PT20M", totalTime: "PT30M", recipeYield: "4 порции", recipeCuisine: "Българска кухня", recipeCategory: "Основни ястия", image: "https://photos.example.org/unauthorized.jpg" };
export const recipeHtml = (data: unknown = structuredRecipe) => `<html><script type="application/ld+json">${JSON.stringify(data)}</script><script>throw new Error('never execute')</script></html>`;
export function discovery(index = 1, title = structuredRecipe.name) { return normalizeSerpResponse({ organic_results: [{ title, link: `https://recipes.example.org/recipes/rice-${index}`, source: "Име от доставчика", snippet: "Кратък тестов откъс" }] }, 0, 1700000000000).results[0]; }
export function webResult(index = 1, complete = true, title = `${structuredRecipe.name} ${index}`): WebRecipeResult {
  const found = { ...discovery(index, title), sourceName: testSource.sourceName };
  const permission = classifyPermission(found.url, complete ? [testSource] : []);
  const recipe = complete ? normalizeAuthorizedRecipe(found, extractRecipe(recipeHtml({ ...structuredRecipe, name: title }))!, permission)! : undefined;
  return { ...found, permission, access: recipe ? "complete" : "metadata_only", ...(recipe ? { recipe } : {}), limitations: recipe ? [] : ["Няма разрешение за пълен текст."] };
}
