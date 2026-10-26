"use client";

import { useRef } from "react";
import { useDialogFocus } from "./useDialogFocus";
import { ADMIN_MODE, SITE_URL } from "../config";
import { savePref, useWorld, worldStore } from "../store";
import { QUALITY_LEVELS, QUALITY_PRESETS } from "../systems/QualityManager";
import styles from "../styles/atomWorld.module.css";
import { ControlsGuide } from "./GameHUD";
import { ENVIRONMENTS, START_ENV } from "../world/registry";
import { OfflineSection } from "./OfflineSection";
import { slotText } from "../world/slots";

/** Pause menu (Esc / ☰): resume, graphics quality, controls, change character, back to site. */
export function GameMenu() {
  const open = useWorld((s) => s.menuOpen);
  const dialogRef = useRef<HTMLElement>(null);
  useDialogFocus(dialogRef, open);
  const quality = useWorld((s) => s.quality);
  const env = useWorld((s) => s.env);
  const sound = useWorld((s) => s.sound);
  const volume = useWorld((s) => s.volume);
  const reducedMotion = useWorld((s) => s.reducedMotion);
  const textScale = useWorld((s) => s.textScale);
  if (!open) return null;
  const close = () => worldStore.set({ menuOpen: false });

  return (
    <div className={styles.backdrop} onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <section className={styles.panel} ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="aw-menu-title" style={{ maxWidth: 420 }}>
        <div className={styles.panelHead}>
          <h2 id="aw-menu-title" className={styles.panelTitle}>
            منو
          </h2>
          <button type="button" className={`${styles.btn} ${styles.iconBtn}`} aria-label="بستن" onClick={close}>
            ✕
          </button>
        </div>
        <div className={styles.menuList}>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={close} autoFocus>
            ▶ ادامهٔ بازی
          </button>
          <button type="button" className={styles.btn} onClick={() => worldStore.set({ menuOpen: false, listOpen: true })}>
            🎯 بازی‌ها و خدمات مجموعه
          </button>
          <button type="button" className={styles.btn} onClick={() => worldStore.set({ menuOpen: false, scoresOpen: true })}>
            🏆 امتیازها و دستاوردها
          </button>
          <button type="button" className={styles.btn} onClick={() => worldStore.set({ menuOpen: false, eventsOpen: true })}>
            📣 تورنومنت‌ها و رویدادها
          </button>
          <button type="button" className={styles.btn} onClick={() => worldStore.set({ menuOpen: false, booking: { machineId: null } })}>
            📅 ساعت کاری و رزرو
          </button>
          {/* places to go: from the environment registry (a new environment appears here by itself) */}
          {env !== START_ENV && (
            <button type="button" className={styles.btn} onClick={() => worldStore.set({ menuOpen: false, travel: { env: START_ENV, spawn: "counter" } })}>
              🚪 بازگشت به سالن اصلی
            </button>
          )}
          {ENVIRONMENTS.filter((e) => e.menuTravel && e.id !== env).map((e) => (
            <button key={e.id} type="button" className={styles.btn} onClick={() => worldStore.set({ menuOpen: false, travel: { env: e.id, spawn: e.menuTravel!.spawn } })}>
              {slotText(`menu:${e.id}`, e.menuTravel!.label)}
            </button>
          ))}
          <div className={styles.sectionLabel}>کیفیت گرافیک</div>
          <div className={styles.seg} role="group" aria-label="کیفیت گرافیک">
            {QUALITY_LEVELS.map((q) => (
              <button
                key={q}
                type="button"
                aria-pressed={quality === q}
                onClick={() => {
                  savePref("quality", q);
                  worldStore.set({ quality: q });
                }}
              >
                {QUALITY_PRESETS[q].label}
              </button>
            ))}
          </div>
          <div className={styles.sectionLabel}>صدا</div>
          <div className={styles.toggleRow}>
            <div className={styles.seg} role="group" aria-label="صدا" style={{ gridTemplateColumns: "repeat(2, 1fr)", flex: 1 }}>
              {[true, false].map((on) => (
                <button
                  key={String(on)}
                  type="button"
                  aria-pressed={sound === on}
                  onClick={() => {
                    savePref("sound", on ? "1" : "0");
                    worldStore.set({ sound: on });
                  }}
                >
                  {on ? "🔊 روشن" : "🔇 خاموش"}
                </button>
              ))}
            </div>
          </div>
          <input
            className={styles.range}
            type="range"
            min={0.1}
            max={1}
            step={0.1}
            value={volume}
            disabled={!sound}
            aria-label="بلندی صدا"
            onChange={(e) => {
              const v = Number(e.target.value);
              savePref("volume", String(v));
              worldStore.set({ volume: v });
            }}
          />
          <div className={styles.sectionLabel}>دسترس‌پذیری</div>
          <div className={styles.seg} role="group" aria-label="کاهش حرکت" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
            {[false, true].map((on) => (
              <button
                key={String(on)}
                type="button"
                aria-pressed={reducedMotion === on}
                onClick={() => {
                  savePref("motion", on ? "1" : "0");
                  worldStore.set({ reducedMotion: on });
                }}
              >
                {on ? "🧘 کاهش حرکت" : "🎥 حرکت عادی"}
              </button>
            ))}
          </div>
          <p className={styles.offlineNote}>«کاهش حرکت» چرخش و لرزش دوربین و نشانه‌های متحرک را خاموش می‌کند (برای کسانی که حالت تهوع می‌گیرند).</p>
          <div className={styles.seg} role="group" aria-label="اندازهٔ متن">
            {[
              [1, "متن معمولی"],
              [1.15, "متن بزرگ"],
              [1.3, "متن خیلی بزرگ"],
            ].map(([v, label]) => (
              <button
                key={String(v)}
                type="button"
                aria-pressed={textScale === v}
                onClick={() => {
                  savePref("text", String(v));
                  worldStore.set({ textScale: v as number });
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <OfflineSection />
          <div className={styles.sectionLabel}>راهنمای کنترل</div>
          <div style={{ fontSize: "0.85rem", lineHeight: 1.9 }}>
            <ControlsGuide />
          </div>
          <div className={styles.sectionLabel} />
          <button type="button" className={styles.btn} onClick={() => worldStore.set({ menuOpen: false, phase: "select" })}>
            👤 تغییر شخصیت
          </button>
          {/* the stand-alone preview has no server: its world editor works on this device (docs/ADMIN_WORLD.md) */}
          {ADMIN_MODE === "local" && (
            <button
              type="button"
              className={styles.btn}
              onClick={() => {
                window.location.hash = "admin";
              }}
            >
              ✏️ ویرایشگر دنیا (مدیر)
            </button>
          )}
          <a className={styles.btn} href={SITE_URL}>
            ↩ بازگشت به سایت اصلی
          </a>
        </div>
      </section>
    </div>
  );
}
