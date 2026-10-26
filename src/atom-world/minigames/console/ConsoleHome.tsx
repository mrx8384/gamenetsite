"use client";

import { useEffect, useRef, useState } from "react";
import { characters } from "../../data/characters";
import { type MiniGameId } from "../../data/machines";
import { worldStore } from "../../store";
import { audio } from "../../systems/AudioManager";
import { stationContext } from "../controller/ControllerGame";
import styles from "../minigames.module.css";
import { MINI_GAMES } from "../registry";
import { fa } from "../types";

/** Games installed on the gaming center's consoles (the station's home screen). */
export const CONSOLE_GAMES: { id: MiniGameId; art: string; tag: string; blurb: string }[] = [
  { id: "gc-city", art: "🏙️", tag: "جهان باز", blurb: "شهر اتم را با پای پیاده یا با تاکسی سبز بگردید، مسافر برسانید و سکه جمع کنید." },
  { id: "gc-football", art: "⚽", tag: "ورزشی", blurb: "فوتسال سه‌نفره در برابر کامپیوتر: پاس بدهید، تکل بزنید و در دو دقیقه بیشتر از حریف گل بزنید." },
  { id: "gc-controller", art: "🎮", tag: "سرعت عمل", blurb: "نشانه‌های روی تلویزیون را با دکمه‌های دسته بزنید؛ هرچه سریع‌تر، بهتر." },
];

/**
 * The station's console home screen (like PS4 / PS5): pick a game with ◀ ▶ (or a tap), open it with
 * ✕ / Enter. Inside a game, «🏠» in the title bar comes back here.
 */
export default function ConsoleHome() {
  const [sel, setSel] = useState(0);
  const [ctx] = useState(() => stationContext(worldStore.get().miniGameFrom));
  const ps5 = ctx.here?.console === "ps5";
  const [now, setNow] = useState(() => new Date());
  const [who] = useState(() => characters[worldStore.get().character]?.name ?? "");
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);
  const wasSelected = useRef<boolean | null>(null);

  const open = (i: number) => {
    audio.openPanel();
    worldStore.set({ miniGame: CONSOLE_GAMES[i].id });
  };
  const move = (d: number) => {
    setSel((s) => {
      const n = (s + d + CONSOLE_GAMES.length) % CONSOLE_GAMES.length;
      tiles.current[n]?.focus();
      return n;
    });
    audio.click();
  };

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 20_000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    tiles.current[0]?.focus();
  }, []);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      // the tiles run right-to-left like the page: ◀ goes to the next one
      if (k === "arrowleft" || k === "a") {
        e.preventDefault();
        move(1);
      } else if (k === "arrowright" || k === "d") {
        e.preventDefault();
        move(-1);
      } else if (k === "k") open(sel);
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  });

  const g = CONSOLE_GAMES[sel];
  return (
    <div className={`${styles.home} ${ps5 ? styles.homePs5 : ""}`}>
      <div className={styles.homeTop}>
        <span className={styles.homeUser}>
          <span aria-hidden>👤</span> {who}
        </span>
        <span>
          {ps5 ? "PS5" : "PS4"}
          {ctx.here ? ` · سیستم ${fa(ctx.here.number)}` : ""}
        </span>
        <span>{now.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
      <div className={styles.homeRow} role="listbox" aria-label="بازی‌های این کنسول">
        {CONSOLE_GAMES.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              tiles.current[i] = el;
            }}
            type="button"
            role="option"
            aria-selected={sel === i}
            className={`${styles.homeTile} ${sel === i ? styles.homeTileOn : ""}`}
            // first tap selects, a tap on the selected tile (or Enter) opens it
            onPointerDown={() => (wasSelected.current = sel === i)}
            onClick={() => {
              const ok = wasSelected.current ?? true;
              wasSelected.current = null;
              if (ok) open(i);
              else setSel(i);
            }}
            onFocus={() => setSel(i)}
          >
            <span className={styles.homeArt} aria-hidden>
              {t.art}
            </span>
            <span className={styles.homeName}>{MINI_GAMES[t.id].title}</span>
          </button>
        ))}
      </div>
      <div className={styles.homeInfo} aria-live="polite">
        <h3>
          {MINI_GAMES[g.id].emoji} {MINI_GAMES[g.id].title} <small>{g.tag}</small>
        </h3>
        <p>{g.blurb}</p>
        <button type="button" className={styles.homePlay} onClick={() => open(sel)}>
          ✕ شروع
        </button>
        <p className={styles.homeHint}>◀ ▶ انتخاب بازی — ✕ یا Enter شروع — 🏠 داخل بازی، بازگشت به این صفحه</p>
      </div>
    </div>
  );
}
