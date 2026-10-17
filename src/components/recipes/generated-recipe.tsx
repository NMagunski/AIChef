"use client";
import Link from "next/link";
import { useGeneratedRecipes } from "@/hooks/use-generated-recipes";
import { RecipeDetails } from "@/components/recipe-details/recipe-details";
import { CookingMode } from "@/components/cooking/cooking-mode";
export function GeneratedRecipe({ id, cooking = false }: { id: string; cooking?: boolean }) {
  const { recipes, hydrated } = useGeneratedRecipes();
  const recipe = recipes.find((entry) => entry.id === id);
  if (!hydrated) return <div role="status">Възстановяваме рецептата…</div>;
  if (!recipe) return <section><h1>{id.startsWith("web-") ? "Интернет рецептата не е налична" : "AI рецептата не е налична"}</h1><p>Временно запазената рецепта липсва, изтекла е или е невалидна. Тя е достъпна само в този браузърен раздел: до 24 часа за AI и до 10 минути за интернет рецепти.</p><Link href="/search">Създай нова рецепта</Link></section>;
  return cooking ? <CookingMode key={id} recipe={recipe} /> : <RecipeDetails key={id} recipe={recipe} />;
}
