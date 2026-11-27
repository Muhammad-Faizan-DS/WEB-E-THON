"use client";
import * as React from "react";

/** Offset (ms) to add to Date.now() to get server time. Updated from any serverNow. */
export function useServerClock() {
  const offset = React.useRef(0);
  const sync = React.useCallback((serverNowIso: string, sentAt: number, receivedAt = Date.now()) => {
    const mid = (sentAt + receivedAt) / 2;
    offset.current = Date.parse(serverNowIso) - mid;
  }, []);
  const now = React.useCallback(() => Date.now() + offset.current, []);
  return React.useMemo(() => ({ sync, now, offset }), [sync, now]);
}

/** Re-render every `ms` milliseconds. */
export function useTick(ms = 1000) {
  const [, set] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => set((x) => x + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}
