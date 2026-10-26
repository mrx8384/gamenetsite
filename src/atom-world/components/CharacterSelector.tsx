"use client";

import { lazy, Suspense, useRef } from "react";
import { SITE_URL } from "../config";
import { type CharacterId, characterIds, characters } from "../data/characters";
import { useWorld, worldStore } from "../store";
import styles from "../styles/atomWorld.module.css";

/** The 3D stage (three.js) arrives as its own download; the cards and the start button work before it. */
const SelectorStage = lazy(() => import("./SelectorStage"));

/**
 * Character selection: both ATOM characters side by side on a black stage lit green and pink.
 * Tap/click a character (or its card) to select it, drag to rotate it, then «شروع ماجراجویی».
 */
export function CharacterSelector({ onStart }: { onStart: (id: CharacterId) => void }) {
  const selected = useWorld((s) => s.character);
  const spin = useRef<Record<CharacterId, number>>({ boy: -0.25, girl: 0.25 });
  const drag = useRef<{ x: number; moved: boolean } | null>(null);

  const select = (id: CharacterId) => worldStore.set({ character: id });

  return (
    <div className={styles.selector}>
      <div className={styles.selectorBg} />
      <header className={styles.selectorHeader}>
        <div className={styles.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/atom-world/textures/atom-logo.webp" alt="" />
          <div className={styles.brandText}>
            ATOM GAME CLUB
            <small>دنیای سه‌بعدی اتم</small>
          </div>
        </div>
        <a className={styles.btn} href={SITE_URL}>
          بازگشت به سایت
        </a>
      </header>

      <div
        className={styles.selectorCanvas}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, moved: false };
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const dx = e.clientX - drag.current.x;
          drag.current.x = e.clientX;
          if (Math.abs(dx) > 1) drag.current.moved = true;
          spin.current[worldStore.get().character] += dx * 0.012;
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        aria-label="پیش‌نمایش سه‌بعدی شخصیت‌ها؛ برای چرخاندن بکشید"
      >
        <h1 className={styles.selectorTitle}>شخصیت خود را انتخاب کنید</h1>
        <Suspense fallback={<StageFallback selected={selected} />}>
          <SelectorStage
            selected={selected}
            spin={spin}
            onPick={(id) => {
              if (!drag.current?.moved) select(id);
            }}
          />
        </Suspense>
      </div>

      <footer className={styles.selectorFooter}>
        <div className={styles.cards} role="group" aria-label="انتخاب شخصیت">
          {characterIds.map((id) => {
            const c = characters[id];
            return (
              <button key={id} type="button" className={styles.card} data-character={id} aria-pressed={selected === id} onClick={() => select(id)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.thumb} alt="" width={44} height={44} />
                <span>
                  <span className={styles.cardName}>{c.name}</span>
                  <br />
                  <span className={styles.cardTag}>{c.tagline}</span>
                </span>
              </button>
            );
          })}
        </div>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => onStart(selected)} style={{ minWidth: 220, minHeight: 52, fontSize: "1.05rem" }}>
          شروع ماجراجویی
        </button>
        <p className={styles.hint}>
          برای چرخاندن شخصیت بکشید · <span className={styles.tempBadge}>مدل سه‌بعدی نسخهٔ ۱ — قابل ارتقا توسط مدل‌ساز</span>
        </p>
      </footer>
    </div>
  );
}

/** Until the 3D stage is loaded: the two character faces on their coloured rings. */
function StageFallback({ selected }: { selected: CharacterId }) {
  return (
    <div className={styles.stageFallback} aria-hidden>
      {characterIds.map((id) => (
        <div key={id} className={styles.stageFace} data-selected={selected === id} style={{ "--accent": characters[id].accent } as React.CSSProperties}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={characters[id].thumb} alt="" />
        </div>
      ))}
      <span className={styles.stageNote}>در حال بارگذاری مدل سه‌بعدی…</span>
    </div>
  );
}
