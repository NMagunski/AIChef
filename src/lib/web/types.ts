import type { QualityResult } from "../recipe-quality/quality-types.ts";
import type { ResolvedRecipe } from "../../types/recipe.ts";
import type { ContentPermission } from "./permissions.ts";
export type SearchOptions = { start?: number; signal?: AbortSignal };
export type WebSearchResult = { id: string; title: string; url: string; domain: string; sourceName: string; description: string; imageUrl: string | null; rank: number; discoveredAt: string };
export interface WebSearchProvider { searchRecipes(query: string, options?: SearchOptions): Promise<{ results: WebSearchResult[]; nextCursor: string | null }> }
export type WebRecipeResult = WebSearchResult & { permission: ContentPermission; access: "complete" | "metadata_only"; discoveryType?: "web_licensed" | "web_metadata_only"; recipe?: ResolvedRecipe; quality?: QualityResult; limitations: string[] };
export type WebSearchPage = { results: WebRecipeResult[]; nextCursor: string | null; limitations: string[] };
