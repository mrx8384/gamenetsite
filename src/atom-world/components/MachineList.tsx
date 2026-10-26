"use client";

import { areaLabel, worldInteractables } from "../world/registry";
import { useRef } from "react";
import { useDialogFocus } from "./useDialogFocus";
import { useMachines } from "../data/machines";
import { areaAt } from "../data/world";
import { envAt, START_ENV } from "../world/registry";
import { useWorld, worldStore } from "../store";
import styles from "../styles/atomWorld.module.css";

/** Every game / service of the club with where it is, its info and «نمایش روی نقشه». */
export function MachineList() {
  const open = useWorld((s) => s.listOpen);
  const dialogRef = useRef<HTMLElement>(null);
  useDialogFocus(dialogRef, open);
  const machines = useMachines();
  const env = useWorld((s) => s.env);
  if (!open) return null;
  const close = () => worldStore.set({ listOpen: false });
  const entries = Object.values(machines)
    .filter((m) => m.listed !== false)
    .map((m) => {
      const spots = worldInteractables().filter((i) => i.machineId === m.id);
      const first = spots[0];
      const area = first ? areaAt(first.position[0], first.position[1] - 0.9, first.position[2]) : null;
      const spotEnv = first ? envAt(first.position[0], first.position[2]) : null;
      return { m, spots, first, area, spotEnv };
    });

  return (
    <div className={styles.backdrop} onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <section className={styles.panel} ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="aw-list-title">
        <div className={styles.panelHead}>
          <h2 id="aw-list-title" className={styles.panelTitle}>
            بازی‌ها و خدمات مجموعه
          </h2>
          <button type="button" className={`${styles.btn} ${styles.iconBtn}`} aria-label="بستن" onClick={close} autoFocus>
            ✕
          </button>
        </div>
        <ul className={styles.list}>
          {entries.map(({ m, spots, first, area, spotEnv }) => (
            <li key={m.id} className={styles.listItem}>
              <div className={styles.listInfo}>
                <span className={styles.listEmoji} aria-hidden>
                  {m.emoji}
                </span>
                <span>
                  <strong>{m.name}</strong>
                  <br />
                  <span className={styles.panelSub}>
                    {area ? areaLabel(area) : ""}
                    {spots.length > 1 ? ` · ${spots.length.toLocaleString("fa-IR")} دستگاه` : ""}
                  </span>
                </span>
              </div>
              <div className={styles.listActions}>
                {m.miniGame && (
                  <button type="button" className={`${styles.btn} ${styles.btnPink}`} onClick={() => worldStore.set({ listOpen: false, miniGame: m.miniGame, miniGameFrom: first?.id ?? null })}>
                    🎮 مینی‌گیم
                  </button>
                )}
                <button type="button" className={styles.btn} onClick={() => worldStore.set({ listOpen: false, panel: first ? { id: first.id, machineId: m.id } : null })}>
                  اطلاعات
                </button>
                {spotEnv && spotEnv.id !== env ? (
                  <button type="button" className={styles.btn} onClick={() => worldStore.set({ listOpen: false, travel: { env: spotEnv.id, spawn: spotEnv.id === START_ENV ? "counter" : undefined } })}>
                    رفتن به این بخش
                  </button>
                ) : (
                  <button type="button" className={styles.btn} onClick={() => worldStore.set({ listOpen: false, mapOpen: true, mapFocus: first?.id ?? null })}>
                    نمایش روی نقشه
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
