import test from "node:test";
import assert from "node:assert/strict";
import { createTimer, formatCountdown, remainingTime, updateTimer } from "../src/lib/cooking-timer.ts";
import { createCookingSession, recipeDataVersion, restoreCookingSession, saveCookingSession, sessionKey, transitionSession, validateCookingSession, type CookingSession, type SessionStorage } from "../src/lib/cooking-session.ts";
import { parseServings } from "../src/lib/servings.ts";
import type { ResolvedRecipe } from "../src/types/recipe.ts";

const now = 1_000_000;
const recipe: ResolvedRecipe = {
  id: "test-recipe", title: "Тестова рецепта", description: "Само тестови данни", minutes: 10, servings: 4, difficulty: "Лесна", category: "Тест", tags: [], visual: { kind: "home", name: "soup" },
  preparation: { preparationMinutes: 2, cookingMinutes: 8, tips: [], ingredients: [{ id: "rice", name: "Ориз", quantity: 300, unit: "g" }, { id: "salt", name: "Сол", quantity: null, unit: null }], steps: [{ id: "one", title: "Първа", description: "Първа стъпка", durationMinutes: 1 }, { id: "two", title: "Втора", description: "Втора стъпка", durationMinutes: 2 }, { id: "three", title: "Трета", description: "Трета стъпка" }] },
};
const act = (session: CookingSession, action: Parameters<typeof transitionSession>[2], at = now) => transitionSession(session, recipe, action, at);

function memoryStorage() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}

test("fresh session starts on step one with no automatic timers", () => {
  const session = createCookingSession(recipe, now, 6);
  assert.equal(session.currentStep, 0);
  assert.equal(session.servings, 6);
  assert.deepEqual(session.completedSteps, []);
  assert.equal(session.timers.one.status, "idle");
  assert.equal(session.timers.two.status, "idle");
  assert.equal(session.timers.three, undefined);
  assert.equal(session.status, "active");
});

test("step navigation cannot skip upcoming steps and preserves completed steps when going back", () => {
  const initial = createCookingSession(recipe, now);
  assert.equal(act(initial, { type: "previous" }), initial);
  assert.equal(act(initial, { type: "go", index: 2 }), initial);
  const second = act(initial, { type: "next" });
  assert.equal(second.currentStep, 1);
  assert.deepEqual(second.completedSteps, ["one"]);
  const first = act(second, { type: "previous" });
  assert.equal(first.currentStep, 0);
  assert.deepEqual(first.completedSteps, ["one"]);
  const secondAgain = act(first, { type: "next" });
  assert.deepEqual(secondAgain.completedSteps, ["one"]);
  const third = act(secondAgain, { type: "next" });
  assert.equal(act(act(third, { type: "go", index: 0 }), { type: "go", index: 1 }).currentStep, 1);
  for (const index of [-1, 3, 0.5, NaN]) assert.equal(act(initial, { type: "go", index }), initial);
});

test("checklist changes survive step changes without mutating recipe ingredients", () => {
  let session = createCookingSession(recipe, now);
  session = act(session, { type: "check", id: "rice" });
  session = act(session, { type: "next" });
  assert.deepEqual(session.checkedIngredients, ["rice"]);
  assert.equal(recipe.preparation!.ingredients[0].quantity, 300);
  assert.deepEqual(act(session, { type: "check", id: "rice" }).checkedIngredients, []);
  assert.equal(act(session, { type: "check", id: "unknown" }), session);
});

test("timer start, pause, resume and reset use deadlines and remaining milliseconds", () => {
  const initial = createTimer(60_000);
  const running = updateTimer(initial, "start", now);
  assert.equal(running.deadline, now + 60_000);
  assert.equal(remainingTime(running, now + 12_000), 48_000);
  const paused = updateTimer(running, "pause", now + 12_000);
  assert.equal(paused.remainingMs, 48_000);
  assert.equal(paused.deadline, null);
  assert.equal(remainingTime(paused, now + 600_000), 48_000);
  const resumed = updateTimer(paused, "resume", now + 600_000);
  assert.equal(resumed.deadline, now + 648_000);
  assert.deepEqual(updateTimer(resumed, "reset", now + 610_000), initial);
  assert.equal(initial.status, "idle");
});

test("background inactivity and late pause reconcile expired timers to completion", () => {
  const running = updateTimer(createTimer(60_000), "start", now);
  assert.equal(remainingTime(running, now + 600_000), 0);
  const completed = updateTimer(running, "sync", now + 600_000);
  assert.equal(completed.status, "completed");
  assert.equal(completed.deadline, null);
  assert.equal(updateTimer(running, "pause", now + 60_000).status, "completed");
  assert.equal(formatCountdown(0), "00:00");
  assert.equal(formatCountdown(61_000), "01:01");
  assert.equal(formatCountdown(500), "00:01");
  assert.equal(formatCountdown(3_600_000), "60:00");
});

test("independent timers keep running across step navigation", () => {
  let session = createCookingSession(recipe, now);
  session = act(session, { type: "timer", id: "one", action: "start" });
  session = act(session, { type: "next" }, now + 10_000);
  session = act(session, { type: "timer", id: "two", action: "start" }, now + 10_000);
  session = act(session, { type: "previous" }, now + 20_000);
  assert.equal(remainingTime(session.timers.one, now + 20_000), 40_000);
  assert.equal(remainingTime(session.timers.two, now + 20_000), 110_000);
  session = act(session, { type: "sync" }, now + 70_000);
  assert.equal(session.timers.one.status, "completed");
  assert.equal(session.timers.two.status, "running");
});

test("session pause resumes only timers that were running at pause", () => {
  let session = createCookingSession(recipe, now);
  session = act(session, { type: "timer", id: "one", action: "start" });
  session = act(session, { type: "timer", id: "two", action: "start" });
  session = act(session, { type: "timer", id: "two", action: "pause" }, now + 5000);
  session = act(session, { type: "pause" }, now + 10_000);
  assert.equal(session.status, "paused");
  assert.deepEqual(session.pausedTimerIds, ["one"]);
  assert.equal(session.timers.one.remainingMs, 50_000);
  assert.equal(act(session, { type: "next" }), session);
  assert.equal(act(session, { type: "timer", id: "one", action: "start" }), session);
  session = act(session, { type: "resume" }, now + 600_000);
  assert.equal(session.timers.one.deadline, now + 650_000);
  assert.equal(session.timers.two.status, "paused");
  assert.deepEqual(session.pausedTimerIds, []);
});

test("sessions persist checklist, servings, completed steps and exact timer deadlines", () => {
  const storage = memoryStorage();
  let session = createCookingSession(recipe, now, 6);
  session = act(session, { type: "check", id: "rice" });
  session = act(session, { type: "timer", id: "one", action: "start" });
  session = act(session, { type: "next" }, now + 5000);
  assert.equal(saveCookingSession(storage, session), true);
  const restored = restoreCookingSession(storage, recipe, now + 30_000);
  assert.equal(restored.notice, null);
  assert.equal(restored.session.currentStep, 1);
  assert.equal(restored.session.servings, 6);
  assert.deepEqual(restored.session.checkedIngredients, ["rice"]);
  assert.deepEqual(restored.session.completedSteps, ["one"]);
  assert.equal(remainingTime(restored.session.timers.one, now + 30_000), 30_000);
  assert.equal(restoreCookingSession(storage, recipe, now + 90_000).session.timers.one.status, "completed");
});

test("selected servings from Recipe Details override servings but preserve progress", () => {
  const storage = memoryStorage();
  const session = act(createCookingSession(recipe, now, 4), { type: "next" });
  saveCookingSession(storage, session);
  const restored = restoreCookingSession(storage, recipe, now + 10, 6).session;
  assert.equal(restored.servings, 6);
  assert.equal(restored.currentStep, 1);
  assert.deepEqual(restored.completedSteps, ["one"]);
  assert.equal(restoreCookingSession(storage, recipe, now + 10, 99).session.servings, 4);
  assert.equal(parseServings("6"), 6);
  assert.equal(parseServings(["6", "2"]), 6);
  for (const value of ["0", "21", "-1", "1.5", "NaN", "1e1", ""]) assert.equal(parseServings(value), undefined);
});

test("sessions are isolated by recipe ID and cannot restore another recipe's payload", () => {
  const storage = memoryStorage();
  const other = { ...recipe, id: "other/recipe" };
  saveCookingSession(storage, act(createCookingSession(recipe, now), { type: "next" }));
  saveCookingSession(storage, createCookingSession(other, now, 2));
  assert.notEqual(sessionKey(recipe.id), sessionKey(other.id));
  assert.equal(restoreCookingSession(storage, recipe, now).session.currentStep, 1);
  assert.equal(restoreCookingSession(storage, other, now).session.currentStep, 0);
  assert.equal(restoreCookingSession(storage, other, now).session.servings, 2);
  storage.setItem(sessionKey(other.id), storage.getItem(sessionKey(recipe.id))!);
  assert.ok(restoreCookingSession(storage, other, now).notice);
});

test("corrupt JSON, invalid fields, impossible progress and tampered timers are rejected", () => {
  const storage = memoryStorage();
  const initial = createCookingSession(recipe, now);
  for (const patch of [
    { recipeId: "wrong" }, { dataVersion: "old" }, { schemaVersion: 2 }, { currentStep: -1 }, { currentStep: 2 },
    { servings: 0 }, { servings: 21 }, { servings: 1.5 }, { checkedIngredients: ["unknown"] },
    { checkedIngredients: ["rice", "rice"] }, { completedSteps: ["two"] }, { status: "oops" },
    { status: "completed" }, { updatedAt: -1 }, { updatedAt: now + 1_000_000 }, { timers: {} },
    { timers: { ...initial.timers, one: { ...initial.timers.one, durationMs: 1 } } },
    { timers: { ...initial.timers, one: { ...initial.timers.one, remainingMs: -1 } } },
    { timers: { ...initial.timers, one: { ...initial.timers.one, status: "running", deadline: now + 1_000_000 } } },
    { pausedTimerIds: ["one"] },
  ]) assert.equal(validateCookingSession({ ...initial, ...patch }, recipe, now), null, JSON.stringify(patch));
  for (const raw of ["{bad", "null", "[]", '"text"', "{}", "x".repeat(262_145)]) {
    storage.setItem(sessionKey(recipe.id), raw);
    const restored = restoreCookingSession(storage, recipe, now);
    assert.ok(restored.notice);
    assert.equal(restored.session.currentStep, 0);
  }
});

test("data version changes invalidate a saved session", () => {
  const storage = memoryStorage();
  saveCookingSession(storage, createCookingSession(recipe, now));
  const changed: ResolvedRecipe = { ...recipe, preparation: { ...recipe.preparation!, steps: recipe.preparation!.steps.map((step) => ({ ...step, description: `${step.description} changed` })) } };
  assert.notEqual(recipeDataVersion(recipe), recipeDataVersion(changed));
  assert.ok(restoreCookingSession(storage, changed, now).notice);
});

test("storage denial and quota errors are handled without crashing", () => {
  const blocked: SessionStorage = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("quota"); } };
  assert.equal(saveCookingSession(blocked, createCookingSession(recipe, now)), false);
  assert.ok(restoreCookingSession(blocked, recipe, now).notice);
  assert.equal(restoreCookingSession(blocked, recipe, now).session.currentStep, 0);
});

test("final step completion is persisted and restart clears progress and timers", () => {
  const storage = memoryStorage();
  let session = createCookingSession(recipe, now, 6);
  session = act(session, { type: "timer", id: "one", action: "start" });
  session = act(session, { type: "check", id: "rice" });
  for (let index = 0; index < 3; index++) session = act(session, { type: "next" }, now + index * 1000);
  assert.equal(session.status, "completed");
  assert.deepEqual(session.completedSteps, ["one", "two", "three"]);
  assert.equal(session.timers.one.status, "paused");
  saveCookingSession(storage, session);
  assert.equal(restoreCookingSession(storage, recipe, now + 10_000).session.status, "completed");
  const restarted = act(session, { type: "reset" });
  assert.equal(restarted.currentStep, 0);
  assert.equal(restarted.status, "active");
  assert.deepEqual(restarted.completedSteps, []);
  assert.deepEqual(restarted.checkedIngredients, []);
  assert.equal(restarted.timers.one.status, "idle");
  assert.equal(restarted.servings, 6);
});

test("timer inputs reject invalid durations", () => {
  for (const duration of [0, -1, Infinity, NaN, 1.5]) assert.throws(() => createTimer(duration), RangeError);
});

test("session transitions keep the original progress and timers immutable", () => {
  const original = createCookingSession(recipe, now);
  Object.freeze(original.completedSteps);
  Object.freeze(original.checkedIngredients);
  Object.freeze(original.pausedTimerIds);
  Object.values(original.timers).forEach(Object.freeze);
  Object.freeze(original.timers);
  Object.freeze(original);
  const moved = act(original, { type: "next" });
  const started = act(original, { type: "timer", id: "one", action: "start" });
  assert.equal(original.currentStep, 0);
  assert.deepEqual(original.completedSteps, []);
  assert.equal(original.timers.one.status, "idle");
  assert.equal(moved.currentStep, 1);
  assert.equal(started.timers.one.status, "running");
});

test("serving changes preserve progress, timers and checklist and reject invalid counts", () => {
  const initial = act(act(act(createCookingSession(recipe, now), { type: "check", id: "rice" }), { type: "next" }), { type: "timer", id: "two", action: "start" });
  const scaled = act(initial, { type: "servings", value: 6 });
  assert.equal(scaled.servings, 6);
  assert.equal(initial.servings, 4);
  assert.deepEqual(scaled.checkedIngredients, ["rice"]);
  assert.deepEqual(scaled.completedSteps, ["one"]);
  assert.deepEqual(scaled.timers, initial.timers);
  for (const value of [0, 21, NaN, 1.5]) assert.equal(act(scaled, { type: "servings", value }), scaled);
  const storage = memoryStorage();
  saveCookingSession(storage, scaled);
  assert.equal(restoreCookingSession(storage, recipe, now).session.servings, 6);
});
