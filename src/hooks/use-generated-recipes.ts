"use client";
import { useMemo, useSyncExternalStore } from "react";
import { generatedStoreEvent, generatedStoreKey, readGeneratedEntries } from "@/lib/ai/recipe-store";
function subscribe(callback: () => void) {
  window.addEventListener(generatedStoreEvent, callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener(generatedStoreEvent, callback); window.removeEventListener("storage", callback); };
}
function snapshot() { try { return sessionStorage.getItem(generatedStoreKey); } catch { return null; } }
const serverSnapshot = () => null;
const hydratedSnapshot = () => true;
const serverHydratedSnapshot = () => false;
export function useGeneratedRecipes() {
  const raw = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const hydrated = useSyncExternalStore(subscribe, hydratedSnapshot, serverHydratedSnapshot);
  const recipes = useMemo(() => readGeneratedEntries(raw).map((entry) => entry.recipe), [raw]);
  return { recipes, hydrated };
}
