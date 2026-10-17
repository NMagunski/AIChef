import { understandQuery } from "../ai/recipe-schema.ts";
export function normalizeWebQuery(query: string) { return query.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("bg"); }
export function buildSearchQuery(query: string) {
  // Preserve the FULL Bulgarian request, including dietary, cuisine and equipment
  // constraints. Never use negative Google operators that could drop "без..." pages.
  return `${normalizeWebQuery(query)} рецепта`;
}
export function webQueryIntent(query: string) { return { ...understandQuery(query), searchQuery: buildSearchQuery(query), originalConstraints: normalizeWebQuery(query) }; }
