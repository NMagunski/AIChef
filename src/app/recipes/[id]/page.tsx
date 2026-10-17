import { GeneratedRecipe } from "@/components/recipes/generated-recipe";
import { webIdPattern } from "@/lib/web/url";
import { generatedIdPattern } from "@/lib/ai/recipe-schema";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRecipeById, getRecipeIds } from "@/lib/recipe-catalog";
import { RecipeDetails } from "@/components/recipe-details/recipe-details";

type Props = { params: Promise<{ id: string }> };

export const dynamicParams = true;
export function generateStaticParams() {
  return getRecipeIds().map((id) => ({ id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const recipe = getRecipeById((await params).id);
  return { title: recipe?.title ?? "Рецептата не е намерена", description: recipe?.description };
}

export default async function RecipePage({ params }: Props) {
  const { id } = await params;
  if (generatedIdPattern.test(id) || webIdPattern.test(id)) return <GeneratedRecipe id={id} />;
  const recipe = getRecipeById(id);
  if (!recipe) notFound();
  return <RecipeDetails key={recipe.id} recipe={recipe} />;
}
