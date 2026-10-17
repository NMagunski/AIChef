"use client";
import { useEffect, useState } from "react";
/** Relative monotonic countdown; no automatic API retry when it reaches zero. */
export function useRetryCooldown(seconds: number = 0) {
  const [timerState, setTimerState] = useState({ seconds, remaining: seconds });
  useEffect(() => {
    if (seconds <= 0) return;
    const deadline = performance.now() + seconds * 1000;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
      setTimerState({ seconds, remaining });
      if (!remaining) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [seconds]);
  return timerState.seconds === seconds ? timerState.remaining : seconds;
}
