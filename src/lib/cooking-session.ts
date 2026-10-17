import type { ResolvedRecipe } from "@/types/recipe";
import { createTimer, updateTimer, type TimerAction, type TimerState } from "./cooking-timer.ts";

export type CookingSession = {
  schemaVersion: 1;
  recipeId: string;
  dataVersion: string;
  currentStep: number;
  completedSteps: string[];
  checkedIngredients: string[];
  servings: number;
  timers: Record<string, TimerState>;
  pausedTimerIds: string[];
  status: "active" | "paused" | "completed";
  updatedAt: number;
};
export type SessionAction =
  | { type: "next" }
  | { type: "servings"; value: number }
  | { type: "previous" }
  | { type: "go"; index: number }
  | { type: "check"; id: string }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "timer"; id: string; action: TimerAction }
  | { type: "sync" }
  | { type: "reset" };
export type SessionStorage = Pick<Storage, "getItem" | "setItem">;

export const sessionKey = (id: string) => `aichef:cooking:v1:${encodeURIComponent(id)}`;
export const validServings = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 20;

export function recipeDataVersion(recipe: ResolvedRecipe): string {
  const data = JSON.stringify([recipe.id, recipe.servings, recipe.preparation]);
  let hash = 2166136261;
  for (let index = 0; index < data.length; index++) hash = Math.imul(hash ^ data.charCodeAt(index), 16777619);
  return `v1-${(hash >>> 0).toString(16)}`;
}

export function createCookingSession(recipe: ResolvedRecipe, now: number, servings = recipe.servings): CookingSession {
  if (!validServings(servings)) throw new RangeError("Invalid serving count.");
  const timers = Object.fromEntries((recipe.preparation?.steps ?? []).filter((step) => Number.isFinite(step.durationMinutes) && step.durationMinutes! > 0).map((step) => [step.id, createTimer(Math.round(step.durationMinutes! * 60_000))]));
  return { schemaVersion: 1, recipeId: recipe.id, dataVersion: recipeDataVersion(recipe), currentStep: 0, completedSteps: [], checkedIngredients: [], servings, timers, pausedTimerIds: [], status: "active", updatedAt: now };
}

export function syncCookingSession(session: CookingSession, now: number): CookingSession {
  let changed = false;
  const timers = Object.fromEntries(Object.entries(session.timers).map(([id, timer]) => {
    const next = updateTimer(timer, "sync", now);
    if (next !== timer) changed = true;
    return [id, next];
  }));
  return changed ? { ...session, timers, updatedAt: now } : session;
}

export function transitionSession(original: CookingSession, recipe: ResolvedRecipe, action: SessionAction, now: number): CookingSession {
  const session = syncCookingSession(original, now);
  const steps = recipe.preparation?.steps ?? [];
  if (action.type === "reset") return createCookingSession(recipe, now, session.servings);
  if (action.type === "sync") return session;
  if (action.type === "servings") return validServings(action.value) && action.value !== session.servings ? { ...session, servings: action.value, updatedAt: now } : session;
  if (action.type === "check") {
    if (!recipe.preparation?.ingredients.some((ingredient) => ingredient.id === action.id)) return session;
    return { ...session, checkedIngredients: session.checkedIngredients.includes(action.id) ? session.checkedIngredients.filter((id) => id !== action.id) : [...session.checkedIngredients, action.id], updatedAt: now };
  }
  if (action.type === "timer") {
    const timer = session.timers[action.id];
    if (!timer || (session.status !== "active" && action.action !== "reset")) return session;
    const next = updateTimer(timer, action.action, now);
    return next === timer ? session : { ...session, timers: { ...session.timers, [action.id]: next }, pausedTimerIds: session.pausedTimerIds.filter((id) => id !== action.id), updatedAt: now };
  }
  if (action.type === "pause" && session.status === "active") {
    return { ...session, status: "paused", pausedTimerIds: Object.keys(session.timers).filter((id) => session.timers[id].status === "running"), timers: Object.fromEntries(Object.entries(session.timers).map(([id, timer]) => [id, updateTimer(timer, "pause", now)])), updatedAt: now };
  }
  if (action.type === "resume" && session.status === "paused") {
    return { ...session, status: "active", pausedTimerIds: [], timers: Object.fromEntries(Object.entries(session.timers).map(([id, timer]) => [id, session.pausedTimerIds.includes(id) ? updateTimer(timer, "resume", now) : timer])), updatedAt: now };
  }
  if (session.status !== "active" || !steps.length) return session;
  if (action.type === "go" || action.type === "previous") {
    const index = action.type === "previous" ? session.currentStep - 1 : action.index;
    if (!Number.isInteger(index) || index < 0 || index >= steps.length || (index > session.currentStep && !session.completedSteps.includes(steps[index].id))) return session;
    return index === session.currentStep ? session : { ...session, currentStep: index, updatedAt: now };
  }
  if (action.type === "next") {
    const done = new Set([...session.completedSteps, steps[session.currentStep].id]);
    const completedSteps = steps.filter((step) => done.has(step.id)).map((step) => step.id);
    if (session.currentStep === steps.length - 1) return { ...session, completedSteps, status: "completed", pausedTimerIds: [], timers: Object.fromEntries(Object.entries(session.timers).map(([id, timer]) => [id, updateTimer(timer, "pause", now)])), updatedAt: now };
    return { ...session, completedSteps, currentStep: session.currentStep + 1, updatedAt: now };
  }
  return session;
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
function uniqueStrings(value: unknown, allowed: string[]): value is string[] {
  return Array.isArray(value) && value.every((id) => typeof id === "string" && allowed.includes(id)) && new Set(value).size === value.length;
}

/** Treat browser storage as untrusted. Only validated fields are restored. */
export function validateCookingSession(value: unknown, recipe: ResolvedRecipe, now: number): CookingSession | null {
  if (!record(value) || value.schemaVersion !== 1 || value.recipeId !== recipe.id || value.dataVersion !== recipeDataVersion(recipe)) return null;
  const steps = recipe.preparation?.steps ?? [];
  const stepIds = steps.map((step) => step.id);
  const ingredientIds = recipe.preparation?.ingredients.map((ingredient) => ingredient.id) ?? [];
  if (!Number.isInteger(value.currentStep) || Number(value.currentStep) < 0 || Number(value.currentStep) >= steps.length || !validServings(value.servings)) return null;
  if (!uniqueStrings(value.completedSteps, stepIds) || !value.completedSteps.every((id, index) => id === stepIds[index]) || Number(value.currentStep) > value.completedSteps.length) return null;
  if (!uniqueStrings(value.checkedIngredients, ingredientIds) || !["active", "paused", "completed"].includes(String(value.status))) return null;
  if (!finite(value.updatedAt) || value.updatedAt < 0 || value.updatedAt > now + 300_000) return null;
  if (value.status === "completed" && (value.completedSteps.length !== steps.length || value.currentStep !== steps.length - 1)) return null;
  const expected = createCookingSession(recipe, now, value.servings).timers;
  if (!record(value.timers) || Object.keys(value.timers).length !== Object.keys(expected).length) return null;
  const timers: Record<string, TimerState> = {};
  for (const [id, initial] of Object.entries(expected)) {
    const timer = value.timers[id];
    if (!record(timer) || timer.durationMs !== initial.durationMs || !finite(timer.remainingMs) || timer.remainingMs < 0 || timer.remainingMs > initial.durationMs) return null;
    if (!["idle", "running", "paused", "completed"].includes(String(timer.status))) return null;
    if (timer.status === "running") {
      if (!finite(timer.deadline) || timer.deadline < 0 || timer.deadline > value.updatedAt + initial.durationMs + 1000 || timer.remainingMs === 0 || value.status !== "active") return null;
    } else if (timer.deadline !== null) return null;
    if ((timer.status === "idle" && timer.remainingMs !== initial.durationMs) || (timer.status === "completed" && timer.remainingMs !== 0) || (timer.status === "paused" && timer.remainingMs === 0)) return null;
    timers[id] = { durationMs: initial.durationMs, remainingMs: timer.remainingMs, deadline: timer.deadline as number | null, status: timer.status as TimerState["status"] };
  }
  if (!uniqueStrings(value.pausedTimerIds, Object.keys(expected)) || value.pausedTimerIds.some((id) => timers[id].status !== "paused") || (value.status !== "paused" && value.pausedTimerIds.length > 0)) return null;
  return syncCookingSession({ schemaVersion: 1, recipeId: recipe.id, dataVersion: recipeDataVersion(recipe), currentStep: Number(value.currentStep), completedSteps: [...value.completedSteps], checkedIngredients: [...value.checkedIngredients], servings: value.servings, timers, pausedTimerIds: [...value.pausedTimerIds], status: value.status as CookingSession["status"], updatedAt: value.updatedAt }, now);
}

export function restoreCookingSession(storage: SessionStorage, recipe: ResolvedRecipe, now: number, preferredServings?: number): { session: CookingSession; notice: string | null } {
  const fresh = () => createCookingSession(recipe, now, validServings(preferredServings) ? preferredServings : recipe.servings);
  try {
    const raw = storage.getItem(sessionKey(recipe.id));
    if (raw === null) return { session: fresh(), notice: null };
    const restored = raw.length < 262_144 ? validateCookingSession(JSON.parse(raw), recipe, now) : null;
    if (!restored) return { session: fresh(), notice: "Запазеният прогрес е невалиден или рецептата е променена. Започваме нова сесия." };
    return { session: validServings(preferredServings) && preferredServings !== restored.servings ? { ...restored, servings: preferredServings, updatedAt: now } : restored, notice: null };
  } catch {
    return { session: fresh(), notice: "Не успяхме да прочетем запазения прогрес. Започваме нова сесия." };
  }
}

export function saveCookingSession(storage: SessionStorage, session: CookingSession): boolean {
  try { storage.setItem(sessionKey(session.recipeId), JSON.stringify(session)); return true; } catch { return false; }
}
