import { GeneratedRecipe } from "@/components/recipes/generated-recipe";
import { webIdPattern } from "@/lib/web/url";
import { generatedIdPattern } from "@/lib/ai/recipe-schema";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRecipeById, getRecipeIds } from "@/lib/recipe-catalog";
import { CookingMode } from "@/components/cooking/cooking-mode";

export const metadata: Metadata = { title: "Режим за готвене" };

export const dynamicParams = true;
export function generateStaticParams() {
  return getRecipeIds().map((id) => ({ id }));
}

export default async function CookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (generatedIdPattern.test(id) || webIdPattern.test(id)) return <GeneratedRecipe id={id} cooking />;
  const recipe = getRecipeById(id);
  if (!recipe?.preparation?.steps.length) notFound();
  return <CookingMode key={id} recipe={recipe} />;
}
