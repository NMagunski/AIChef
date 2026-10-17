import { cookies } from "next/headers";
import type { Metadata } from "next";
import { SearchResults } from "@/components/search/search-results";

export const metadata: Metadata = { title: "Търсене на рецепти" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; mode?: string }> }) {
  const params = await searchParams;
  const rawQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = (rawQuery ?? "").trim().slice(0, 501);
  const selected = params.mode ?? (await cookies()).get("recipe-search-mode")?.value ?? process.env.RECIPE_SEARCH_MODE;
  const mode = selected === "demo" ? "demo" : "ai";
  return <SearchResults key={`${mode}:${query}`} query={query} mode={mode} />;
}
