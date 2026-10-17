"use client";
import { createContext, useContext, useState, type ReactNode } from "react";

const FavoritesContext = createContext<{ ids: string[]; toggle: (id: string) => void } | null>(null);
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  function toggle(id: string) { setIds((previous) => previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id]); }
  return <FavoritesContext.Provider value={{ ids, toggle }}>{children}</FavoritesContext.Provider>;
}
export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error("FavoritesProvider is required");
  return context;
}
