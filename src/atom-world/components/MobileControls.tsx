"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useWorld, worldStore } from "../store";
import type { InputState } from "../systems/input";
import styles from "../styles/atomWorld.module.css";

const RADIUS = 52;

function useTouchDevice() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia("(pointer: coarse)");
      m.addEventListener("change", cb);
      window.addEventListener("touchstart", cb, { once: true, passive: true });
      return () => {
        m.removeEventListener("change", cb);
        window.removeEventListener("touchstart", cb);
      };
    },
    () => window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0,
    () => false,
  );
}

/**
 * Touch controls: floating virtual joystick on the left 40% of the screen (camera drag on the
 * right is handled by the camera controller), plus run / jump / interact / menu buttons.
 */
export function MobileControls({ inputRef }: { inputRef: { readonly current: InputState } }) {
  const touch = useTouchDevice();
  const nearby = useWorld((s) => s.nearby);
  const blocked = useWorld((s) => s.menuOpen || s.mapOpen || s.panel !== null);
  const [run, setRun] = useState(false);
  const [stick, setStick] = useState<{ x: number; y: number; kx: number; ky: number } | null>(null);
  const active = useRef<number | null>(null);

  useEffect(() => {
    inputRef.current.run = run;
  }, [run, inputRef]);

  useEffect(() => {
    if (blocked) {
      active.current = null;
      inputRef.current.moveX = 0;
      inputRef.current.moveY = 0;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- release the stick when an overlay opens
      setStick(null);
    }
  }, [blocked, inputRef]);

  if (!touch || blocked) return null;

  const update = (cx: number, cy: number, px: number, py: number) => {
    let dx = px - cx;
    let dy = py - cy;
    const d = Math.hypot(dx, dy);
    if (d > RADIUS) {
      dx = (dx / d) * RADIUS;
      dy = (dy / d) * RADIUS;
    }
    inputRef.current.moveX = dx / RADIUS;
    inputRef.current.moveY = -dy / RADIUS;
    setStick({ x: cx, y: cy, kx: dx, ky: dy });
  };

  const release = () => {
    active.current = null;
    inputRef.current.moveX = 0;
    inputRef.current.moveY = 0;
    setStick(null);
  };

  return (
    <>
      <div
        className={styles.joyZone}
        onPointerDown={(e) => {
          if (active.current !== null) return;
          active.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          const r = e.currentTarget.getBoundingClientRect();
          update(e.clientX - r.left, e.clientY - r.top, e.clientX - r.left, e.clientY - r.top);
        }}
        onPointerMove={(e) => {
          if (active.current !== e.pointerId || !stick) return;
          const r = e.currentTarget.getBoundingClientRect();
          update(stick.x, stick.y, e.clientX - r.left, e.clientY - r.top);
        }}
        onPointerUp={(e) => active.current === e.pointerId && release()}
        onPointerCancel={(e) => active.current === e.pointerId && release()}
      >
        {stick ? (
          <div className={styles.joyBase} style={{ left: stick.x, top: stick.y }}>
            <div className={styles.joyKnob} style={{ transform: `translate(${stick.kx}px, ${stick.ky}px)` }} />
          </div>
        ) : (
          <div className={styles.joyHint}>برای حرکت اینجا را لمس کنید</div>
        )}
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.action} aria-pressed={run} onPointerDown={() => setRun((v) => !v)}>
          <span>
            <span className={styles.actionIcon} aria-hidden>🏃</span>دویدن
          </span>
        </button>
        <button
          type="button"
          className={`${styles.action} ${nearby ? styles.actionHot : ""}`}
          onPointerDown={() => {
            inputRef.current.interact = true;
          }}
          disabled={!nearby}
        >
          <span>
            <span className={styles.actionIcon} aria-hidden>✋</span>تعامل
          </span>
        </button>
        <button type="button" className={styles.action} onPointerDown={() => worldStore.set({ menuOpen: true })}>
          <span>
            <span className={styles.actionIcon} aria-hidden>☰</span>منو
          </span>
        </button>
        <button
          type="button"
          className={styles.action}
          onPointerDown={() => {
            inputRef.current.jump = true;
          }}
        >
          <span>
            <span className={styles.actionIcon} aria-hidden>⤒</span>پرش
          </span>
        </button>
      </div>
    </>
  );
}
