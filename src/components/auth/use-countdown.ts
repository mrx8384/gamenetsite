"use client";

import * as React from "react";

/** Seconds remaining until a code can be re-sent. */
export function useCountdown() {
  const [seconds, setSeconds] = React.useState(0);
  React.useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);
  return { seconds, start: setSeconds };
}
