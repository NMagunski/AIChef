export type TimerState = {
  durationMs: number;
  remainingMs: number;
  deadline: number | null;
  status: "idle" | "running" | "paused" | "completed";
};
export type TimerAction = "start" | "pause" | "resume" | "reset" | "sync";

export function createTimer(durationMs: number): TimerState {
  if (!Number.isSafeInteger(durationMs) || durationMs <= 0) throw new RangeError("Timer duration must be positive integer milliseconds.");
  return { durationMs, remainingMs: durationMs, deadline: null, status: "idle" };
}

export function remainingTime(timer: TimerState, now: number): number {
  return timer.status === "running" && timer.deadline !== null
    ? Math.min(timer.remainingMs, Math.max(0, timer.deadline - now))
    : timer.remainingMs;
}

export function updateTimer(timer: TimerState, action: TimerAction, now: number): TimerState {
  if (action === "reset") return createTimer(timer.durationMs);
  const remainingMs = remainingTime(timer, now);
  if (timer.status === "running" && remainingMs === 0) return { ...timer, remainingMs: 0, deadline: null, status: "completed" };
  if ((action === "start" || action === "resume") && (timer.status === "idle" || timer.status === "paused")) return { ...timer, deadline: now + remainingMs, status: "running" };
  if (action === "pause" && timer.status === "running") return { ...timer, remainingMs, deadline: null, status: "paused" };
  return timer;
}

export function formatCountdown(milliseconds: number): string {
  const seconds = Math.ceil(Math.max(0, milliseconds) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
