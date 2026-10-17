"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { ResolvedRecipe } from "@/types/recipe";
import { parseServings } from "@/lib/servings";
import { createCookingSession, recipeDataVersion, sessionKey, restoreCookingSession, saveCookingSession, transitionSession, type CookingSession, type SessionAction, type SessionStorage } from "@/lib/cooking-session";

type Snapshot = { session: CookingSession | null; now: number; storageAvailable: boolean; notice: string | null };

function createStore(recipe: ResolvedRecipe, preferredServings?: number) {
  const serverSnapshot: Snapshot = { session: null, now: 0, storageAvailable: true, notice: null };
  let snapshot = serverSnapshot;
  let storage: SessionStorage | null = null;
  let initialized = false;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());

  function persist(session: CookingSession) {
    const saved = storage !== null && saveCookingSession(storage, session);
    return saved;
  }

  function restore() {
    if (initialized && !snapshot.storageAvailable) { tick(); return; }
    initialized = true;
    const now = Date.now();
    const selectedServings = preferredServings ?? parseServings(new URLSearchParams(window.location.search).get("servings") ?? undefined);
    try { storage = window.localStorage; } catch { storage = null; }
    const result = storage ? restoreCookingSession(storage, recipe, now, selectedServings) : { session: createCookingSession(recipe, now, selectedServings), notice: null };
    // A direct-link serving override is consumed once, so refresh cannot undo later selections.
    if (selectedServings !== undefined) {
      const url = new URL(window.location.href);
      url.searchParams.delete("servings");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
    const available = persist(result.session);
    snapshot = { session: result.session, now, storageAvailable: available, notice: available ? result.notice : "Локалното запазване е недостъпно. Можеш да готвиш, но прогресът може да се загуби след изход или презареждане." };
    emit();
  }

  function dispatch(action: SessionAction) {
    if (!snapshot.session) return;
    const now = Date.now();
    const next = transitionSession(snapshot.session, recipe, action, now);
    const changed = next !== snapshot.session;
    const available = changed ? persist(next) : snapshot.storageAvailable;
    snapshot = { ...snapshot, session: next, now, storageAvailable: available, notice: changed && !available ? "Прогресът е само в паметта: браузърът не позволява локално запазване." : snapshot.notice };
    emit();
  }

  function tick() {
    if (snapshot.session && Object.values(snapshot.session.timers).some((timer) => timer.status === "running")) dispatch({ type: "sync" });
  }

  return {
    restore, dispatch, tick,
    reload: (event: StorageEvent) => { if (event.key === sessionKey(recipe.id) || event.key === null) { initialized = false; restore(); } },
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    flush: () => { if (snapshot.session) persist(snapshot.session); },
    dismissNotice: () => { snapshot = { ...snapshot, notice: null }; emit(); },
  };
}

const stores = new Map<string, ReturnType<typeof createStore>>();
function getStore(recipe: ResolvedRecipe, preferredServings?: number) {
  if (typeof window === "undefined") return createStore(recipe, preferredServings);
  const key = `${recipe.id}:${recipeDataVersion(recipe)}`;
  let store = stores.get(key);
  if (!store) { store = createStore(recipe, preferredServings); stores.set(key, store); }
  return store;
}

/** Storage and timestamps are initialized only after hydration. */
export function useCookingSession(recipe: ResolvedRecipe, preferredServings?: number) {
  const store = useMemo(() => getStore(recipe, preferredServings), [recipe, preferredServings]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  useEffect(() => {
    store.restore();
    const interval = window.setInterval(store.tick, 500);
    document.addEventListener("visibilitychange", store.tick);
    window.addEventListener("focus", store.tick);
    window.addEventListener("pageshow", store.tick);
    window.addEventListener("pagehide", store.flush);
    window.addEventListener("storage", store.reload);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", store.tick);
      window.removeEventListener("focus", store.tick);
      window.removeEventListener("pageshow", store.tick);
      window.removeEventListener("pagehide", store.flush);
      window.removeEventListener("storage", store.reload);
      store.flush();
    };
  }, [store]);

  return { ...snapshot, dispatch: store.dispatch, flush: store.flush, dismissNotice: store.dismissNotice };
}
