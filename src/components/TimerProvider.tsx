"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ActiveTimer } from "@/lib/timers";

// -----------------------------------------------------------------------------
// Live sample-collection timers, shared by the header widget, the due banner and
// the tests list.
//
// The authoritative due times come from the server (src/lib/timers.ts); we poll
// them every POLL_MS and tick a local 1s clock in between so countdowns move
// smoothly without hammering the API. `skewMs` corrects for a workstation clock
// that disagrees with the server's.
// -----------------------------------------------------------------------------

const POLL_MS = 30_000;

interface TimerContextValue {
  timers: ActiveTimer[];
  /** Milliseconds remaining until `nextDueAt`; negative once the sample is due. */
  remainingMs: (timer: ActiveTimer) => number;
  refresh: () => void;
  loaded: boolean;
}

const TimerContext = createContext<TimerContextValue>({
  timers: [],
  remainingMs: () => 0,
  refresh: () => {},
  loaded: false,
});

export function useTimers(): TimerContextValue {
  return useContext(TimerContext);
}

/** Countdown as "M:SS" (or "H:MM:SS" past an hour). Negative clamps to 0:00. */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
  return hours > 0
    ? `${hours}:${mm}:${String(seconds).padStart(2, "0")}`
    : `${mm}:${String(seconds).padStart(2, "0")}`;
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const [timers, setTimers] = useState<ActiveTimer[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Local clock, re-rendered once a second to drive the countdown text.
  const [now, setNow] = useState(() => Date.now());
  const skewRef = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/timers", { cache: "no-store" });
      if (!res.ok) return; // signed out or forbidden — leave the last known list
      const data = (await res.json()) as { timers: ActiveTimer[]; serverNow: number };
      skewRef.current = data.serverNow - Date.now();
      setTimers(data.timers);
    } catch {
      // Offline or a dropped request; the next poll will pick things up.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const poll = setInterval(() => void refresh(), POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    // A backgrounded tab throttles timers, so resync the moment it comes back.
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const remainingMs = useCallback(
    (timer: ActiveTimer) =>
      new Date(timer.nextDueAt).getTime() - (now + skewRef.current),
    [now]
  );

  return (
    <TimerContext.Provider value={{ timers, remainingMs, refresh, loaded }}>
      {children}
    </TimerContext.Provider>
  );
}
