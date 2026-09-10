// FRPB — useElapsed hook.
// Ticking elapsed-time counter used by the FRP unlock / flash-reset wizards.
// While `isRunning` is true it counts whole seconds from `startTimestamp`
// (defaults to the moment the counter starts) and formats them as MM:SS.

import { useEffect, useState } from "react";

export interface UseElapsedResult {
  /** Elapsed time formatted as `MM:SS` (e.g. "01:25"). */
  formatted: string;
  /** Total elapsed whole seconds. */
  seconds: number;
}

function formatMMSS(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Returns the elapsed time (formatted `MM:SS` plus total seconds) since the
 * operation started. Resets to zero whenever `isRunning` is false.
 *
 * @param isRunning       Ticks while true; resets and stops while false.
 * @param startTimestamp  Optional epoch-ms anchor; defaults to the moment the
 *                        counter starts ticking.
 */
export function useElapsed(
  isRunning: boolean,
  startTimestamp?: number | null
): UseElapsedResult {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!isRunning) {
      setSeconds(0);
      return;
    }

    const startedAt = startTimestamp ?? Date.now();
    const tick = () =>
      setSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();

    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [isRunning, startTimestamp]);

  return { formatted: formatMMSS(seconds), seconds };
}

export default useElapsed;
