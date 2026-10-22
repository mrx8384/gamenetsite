"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** False during SSR/hydration, true once the client has taken over (no effect flicker). */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
