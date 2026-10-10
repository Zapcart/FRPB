// FRPB — responsive promotional countdown timer.
//
// Hydration-safe by construction: it renders a stable, deterministic
// placeholder on the server and first client paint, and only starts a 1s
// interval inside useEffect. It never reads `Date.now()` during render, so
// React can hydrate without an SSR/client text mismatch.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Clock } from "lucide-react";

export interface CountdownTimerProps {
  /** ISO instant the offer closes. */
  endsAt: string;
  /** Visual treatment. `banner` = larger segments; `inline` = compact. */
  variant?: "banner" | "inline";
  /** Optional className merged onto the wrapper. */
  className?: string;
  /** Called once when the timer crosses zero. */
  onExpire?: () => void;
  /** Accessible label for the timer region. */
  label?: string;
}

interface Segments {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function diffSegments(msRemaining: number): Segments {
  const total = Math.max(0, Math.floor(msRemaining / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

export default function CountdownTimer({
  endsAt,
  variant = "banner",
  className,
  onExpire,
  label = "Time remaining in launch offer",
}: CountdownTimerProps) {
  const target = useMemo(() => new Date(endsAt).getTime(), [endsAt]);
  // SSR/initial render placeholder: all-zero segments, no clock read.
  const [segments, setSegments] = useState<Segments>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [expired, setExpired] = useState(false);
  const firedRef = useRef(false);

  useEffect(() => {
    if (Number.isNaN(target)) {
      console.error(`[promo/countdown] invalid endsAt: ${endsAt}`);
      setExpired(true);
      return;
    }

    let interval: number | undefined;

    const tick = () => {
      const remaining = target - Date.now();
      if (remaining <= 0) {
        setSegments({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        setExpired(true);
        if (!firedRef.current) {
          firedRef.current = true;
          onExpire?.();
        }
        if (interval !== undefined) window.clearInterval(interval);
        return;
      }
      setSegments(diffSegments(remaining));
    };

    tick();
    interval = window.setInterval(tick, 1000);

    return () => {
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [target, endsAt, onExpire]);

  const isBanner = variant === "banner";

  if (expired) {
    return (
      <div
        role="timer"
        aria-live="polite"
        aria-label="Launch offer status"
        className={`inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 ${
          className ?? ""
        }`}
      >
        <Clock className="h-4 w-4 shrink-0" aria-hidden />
        Offer ended — standard term applies
      </div>
    );
  }

  const units: { key: keyof Segments; value: string; suffix: string }[] = [
    { key: "days", value: pad(segments.days), suffix: "d" },
    { key: "hours", value: pad(segments.hours), suffix: "h" },
    { key: "minutes", value: pad(segments.minutes), suffix: "m" },
    { key: "seconds", value: pad(segments.seconds), suffix: "s" },
  ];

  return (
    <div
      role="timer"
      aria-live="polite"
      aria-label={label}
      className={`inline-flex items-center gap-2 ${className ?? ""}`}
    >
      <Clock
        className={isBanner ? "h-4 w-4 shrink-0 text-accent-500" : "h-3.5 w-3.5 shrink-0 text-accent-500"}
        aria-hidden
      />
      <span className="grid auto-cols-max grid-flow-col gap-1.5">
        {units.map((u) => (
          <span
            key={u.key}
            className={
              isBanner
                ? "flex min-w-[2.75rem] flex-col items-center rounded-md bg-slate-900 px-2 py-1 tabular-nums text-white motion-reduce:transition-none"
                : "flex min-w-[2.25rem] flex-col items-center rounded bg-slate-100 px-1.5 py-0.5 tabular-nums text-slate-900"
            }
          >
            <span className={isBanner ? "text-lg font-bold leading-none" : "text-sm font-semibold leading-none"}>
              {u.value}
            </span>
            <span
              className={
                isBanner
                  ? "mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400"
                  : "text-[9px] font-medium uppercase tracking-wide text-slate-500"
              }
            >
              {u.suffix}
            </span>
          </span>
        ))}
      </span>
    </div>
  );
}
