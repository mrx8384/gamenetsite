"use client";

import { useRef } from "react";
import styles from "./minigames.module.css";

/**
 * On-screen joystick. Reports x (right +) and y (up +) in -1..1 while held; 0, 0 on release.
 * Labels name what each direction does (accessible name + small captions).
 */
export function VirtualStick({ label, up, down, left, right, onChange }: { label: string; up: string; down: string; left: string; right: string; onChange: (x: number, y: number) => void }) {
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const active = useRef<number | null>(null);

  const update = (e: React.PointerEvent) => {
    const b = base.current!.getBoundingClientRect();
    const r = b.width / 2;
    let dx = (e.clientX - (b.left + r)) / r;
    let dy = (e.clientY - (b.top + r)) / r;
    const d = Math.hypot(dx, dy);
    if (d > 1) {
      dx /= d;
      dy /= d;
    }
    knob.current!.style.transform = `translate(${dx * r * 0.55}px, ${dy * r * 0.55}px)`;
    // small dead zone, then each axis on its own (easier to work one joint at a time)
    const ax = (v: number) => (Math.abs(v) < 0.18 ? 0 : Math.sign(v) * Math.min(1, (Math.abs(v) - 0.18) / 0.7));
    onChange(ax(dx), -ax(dy));
  };
  const end = () => {
    active.current = null;
    if (knob.current) knob.current.style.transform = "";
    onChange(0, 0);
  };

  return (
    <div className={styles.stickWrap}>
      <span className={styles.stickCap}>{up}</span>
      <div className={styles.stickRow}>
        <span className={styles.stickCap}>{left}</span>
        <div
          ref={base}
          className={styles.stick}
          role="application"
          aria-label={`${label}: بالا ${up}، پایین ${down}، چپ ${left}، راست ${right}`}
          onPointerDown={(e) => {
            if (active.current !== null) return;
            active.current = e.pointerId;
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              /* pointer already gone */
            }
            update(e);
          }}
          onPointerMove={(e) => e.pointerId === active.current && update(e)}
          onPointerUp={(e) => e.pointerId === active.current && end()}
          onPointerCancel={(e) => e.pointerId === active.current && end()}
          onLostPointerCapture={(e) => e.pointerId === active.current && end()}
        >
          <div ref={knob} className={styles.knob} />
        </div>
        <span className={styles.stickCap}>{right}</span>
      </div>
      <span className={styles.stickCap}>{down}</span>
    </div>
  );
}
