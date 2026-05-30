import { useEffect, useState } from "react";

/**
 * Date.now()-based countdown. Drift-free across long sessions and tab backgrounding —
 * we don't decrement, we compute `unlockAt - Date.now()` each tick.
 *
 * @param unlockAtMs absolute unlock timestamp in ms (or `null` to disable)
 * @param tickMs how often to recompute (default 250ms — smooth but cheap)
 */
export function useCountdown(unlockAtMs: number | null, tickMs = 250) {
  const [remainingMs, setRemainingMs] = useState(() =>
    unlockAtMs == null ? 0 : Math.max(0, unlockAtMs - Date.now()),
  );

  useEffect(() => {
    if (unlockAtMs == null) {
      setRemainingMs(0);
      return;
    }
    const id = setInterval(() => {
      setRemainingMs(Math.max(0, unlockAtMs - Date.now()));
    }, tickMs);
    // immediate update to avoid initial tick lag
    setRemainingMs(Math.max(0, unlockAtMs - Date.now()));
    return () => clearInterval(id);
  }, [unlockAtMs, tickMs]);

  return {
    remainingMs,
    remainingSec: Math.ceil(remainingMs / 1000),
    expired: remainingMs <= 0,
  };
}
