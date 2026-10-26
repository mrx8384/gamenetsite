"use client";

import { useEffect, useRef } from "react";

/**
 * Canvas that fills its parent at device resolution (capped at 2× for battery) and a rAF loop.
 * `frame(ctx, w, h, dt)` gets CSS-pixel sizes; the transform is already scaled.
 */
export function useCanvasLoop(frame: (ctx: CanvasRenderingContext2D, w: number, h: number, dt: number) => void) {
  const ref = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(frame);
  useEffect(() => {
    frameRef.current = frame;
  });
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    let w = 0;
    let h = 0;
    const resize = () => {
      const r = c.parentElement!.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(c.parentElement!);
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      if (!document.hidden) frameRef.current(ctx, w, h, dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);
  return ref;
}

/** Calls onHud only when the shown values change (avoids re-rendering every frame). */
export function useHudThrottle<T>(onHud: (v: T) => void) {
  const last = useRef("");
  return (v: T) => {
    const k = JSON.stringify(v);
    if (k !== last.current) {
      last.current = k;
      onHud(v);
    }
  };
}

/** ?debug=1: the running mini-game's state as window.__atomMiniGame (automated tests only). */
export function exposeForTests(state: unknown) {
  if (!new URLSearchParams(window.location.search).has("debug")) return;
  const w = window as unknown as { __atomMiniGame?: unknown };
  w.__atomMiniGame = state;
  return () => {
    if (w.__atomMiniGame === state) delete w.__atomMiniGame;
  };
}
