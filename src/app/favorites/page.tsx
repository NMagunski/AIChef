import type { Metadata } from "next";
import { FavoritesList } from "@/components/recipes/favorites-list";
export const metadata: Metadata = { title: "Любими" };
export default function FavoritesPage() {
  return <section><h1>Любими рецепти</h1><p>Запазени за текущата сесия. След презареждане списъкът се изчиства.</p><FavoritesList /></section>;
}
