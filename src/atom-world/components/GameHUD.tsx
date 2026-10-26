"use client";

import { areaLabel } from "../world/registry";
import { useSyncExternalStore } from "react";
import { SITE_URL } from "../config";
import { characters } from "../data/characters";
import { useMachines } from "../data/machines";
import { closeHelp, useWorld, worldStore } from "../store";
import styles from "../styles/atomWorld.module.css";

const coarseQuery = "(pointer: coarse)";
function useCoarsePointer() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(coarseQuery);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(coarseQuery).matches,
    () => false,
  );
}

/** Top bar (logo, character, floor, map/menu/back), interaction prompt and controls guide. */
export function GameHUD() {
  const character = useWorld((s) => s.character);
  const nearby = useWorld((s) => s.nearby);
  const panel = useWorld((s) => s.panel);
  const menuOpen = useWorld((s) => s.menuOpen);
  const helpOpen = useWorld((s) => s.helpOpen);
  const area = useWorld((s) => s.area);
  const touch = useCoarsePointer();
  const all = useMachines();
  const machine = nearby ? all[nearby.machineId] : undefined;
  const c = characters[character];

  // screen readers: say what is nearby and where the player is
  const announce = machine ? `${machine.name} نزدیک شماست؛ برای باز کردن کلید E یا دکمهٔ پایین صفحه را بزنید.` : `اکنون در ${areaLabel(area)}`;

  return (
    <div className={styles.hud}>
      <div className={styles.srOnly} role="status" aria-live="polite">
        {announce}
      </div>
      <div className={styles.topBar}>
        <div className={styles.hudBrand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/atom-world/textures/atom-logo.webp" alt="ATOM GAME CLUB" />
          <div>
            <div className={styles.hudName} style={{ color: c.accent }}>
              {c.name}
            </div>
            <div className={styles.hudFloor}>{areaLabel(area)}</div>
          </div>
        </div>
        <div className={styles.hudButtons}>
          <button type="button" className={`${styles.btn} ${styles.iconBtn}`} aria-label="نقشه" title="نقشه" onClick={() => worldStore.set({ mapOpen: true })}>
            🗺️
          </button>
          <button type="button" className={`${styles.btn} ${styles.iconBtn}`} aria-label="منو" title="منو (Esc)" onClick={() => worldStore.set({ menuOpen: !menuOpen })}>
            ☰
          </button>
          <a className={styles.btn} href={SITE_URL} title="بازگشت به سایت">
            <span aria-hidden>↩</span>
            <span className={styles.hudBtnLabel}>بازگشت به سایت</span>
          </a>
        </div>
      </div>

      {machine && !panel && !menuOpen && (
        <button type="button" className={`${styles.prompt} ${touch ? styles.promptTouch : ""}`} onClick={() => worldStore.set(machine.travel ? { travel: machine.travel, nearby: null } : machine.opens === "events" ? { eventsOpen: true } : { panel: nearby })}>
          {!touch && <span className={styles.key}>E</span>}
          <span>{machine.prompt}</span>
        </button>
      )}

      {helpOpen && !touch && (
        <div className={styles.help} role="note">
          <h3>راهنمای کنترل</h3>
          <ControlsGuide />
          <button type="button" className={`${styles.btn} ${styles.helpClose}`} onClick={closeHelp}>
            متوجه شدم
          </button>
        </div>
      )}
    </div>
  );
}

/** Area id → Persian label, from every registered environment (world/registry.ts). */

export function ControlsGuide() {
  const rows: [string, string][] = [
    ["W A S D", "حرکت"],
    ["Shift", "دویدن"],
    ["Space", "پریدن"],
    ["E", "تعامل با دستگاه"],
    ["ماوس", "کشیدن برای چرخاندن دوربین · چرخ برای زوم"],
    [", .", "چرخاندن دوربین با کیبورد"],
    ["- =", "دور و نزدیک کردن دوربین"],
    ["M", "نقشهٔ بزرگ"],
    ["Tab", "رفتن بین دکمه‌ها (Enter برای انتخاب)"],
    ["Esc", "منو / بستن پنجره"],
  ];
  return (
    <div>
      {rows.map(([k, v]) => (
        <div key={k} className={styles.helpRow}>
          <span className={styles.key}>{k}</span>
          <span>{v}</span>
        </div>
      ))}
      <div className={styles.helpRow} style={{ marginTop: 6, color: "#a8ada9" }}>
        موبایل: جوی‌استیک سمت چپ، کشیدن سمت راست برای دوربین، دو انگشت برای زوم
      </div>
    </div>
  );
}
