"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import { loadWorldConfig } from "./world/applyConfig";
import { CharacterSelector } from "./components/CharacterSelector";
import { audio } from "./systems/AudioManager";
import { type CharacterId, isCharacterId } from "./data/characters";
import { hasSeenHelp, loadPref, savePref, useWorld, worldStore } from "./store";
import { detectQuality, isQualityLevel, readDeviceHints } from "./systems/QualityManager";
import { releaseAll } from "./systems/release";
import { initOffline } from "./systems/offline";
import { SITE_URL } from "./config";
import styles from "./styles/atomWorld.module.css";

/** The 3D world (three.js, scene, overlays) is a separate download, fetched while the player picks a character. */
// the manager's world configuration (admin editor) is applied before the session builds the world
const loadSession = () => Promise.all([import("./GameSession"), loadWorldConfig()]).then(([m]) => m);
const GameSession = lazy(loadSession);


/** ATOM World: character selection → game session. */
export function AtomWorldApp() {
  const phase = useWorld((s) => s.phase);
  const reducedMotion = useWorld((s) => s.reducedMotion);
  const textScale = useWorld((s) => s.textScale);

  // «اندازهٔ متن»: the overlay is sized in rem, so scale the page's root font while the world is open
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.fontSize;
    html.style.fontSize = textScale === 1 ? prev : `${textScale * 100}%`;
    return () => {
      html.style.fontSize = prev;
    };
  }, [textScale]);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [session, setSession] = useState(0);

  useEffect(() => {
    const c = loadPref("character");
    const q = loadPref("quality");
    const snd = loadPref("sound");
    const vol = Number(loadPref("volume"));
    const motion = loadPref("motion");
    const text = Number(loadPref("text"));
    worldStore.set({
      sound: snd !== "0",
      // follows the phone's «reduce motion» setting unless changed in the menu
      reducedMotion: motion === null ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : motion === "1",
      textScale: [1, 1.15, 1.3].includes(text) ? text : 1,
      volume: Number.isFinite(vol) && vol > 0 && vol <= 1 ? vol : 0.7,
      phase: "select",
      character: isCharacterId(c) ? c : "boy",
      quality: isQualityLevel(q) ? q : detectQuality(readDeviceHints()),
      nearby: null,
      panel: null,
      menuOpen: false,
      mapOpen: false,
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time capability probe on mount
    setWebgl(hasWebGL());
    // leaving /atom-world: drop cached models and textures so the site gets its memory back
    // invite link from a friend: /atom-world?room=12345&game=foot-pool
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room");
    const game = params.get("game");
    if (room && /^\d{5}$/.test(room) && (game === "air-hockey" || game === "foot-pool")) worldStore.set({ pendingRoom: { code: room, game } });
    // start downloading the world right away (the selector is shown meanwhile)
    void loadSession();
    initOffline();
    return () => {
      releaseAll();
      audio.stopAmbient();
    };
  }, []);

  if (webgl === false) {
    return (
      <div className={styles.root}>
        <div className={styles.loading}>
          <div className={styles.error}>
            <p>مرورگر شما از WebGL پشتیبانی نمی‌کند یا شتاب‌دهندهٔ گرافیکی غیرفعال است؛ برای ورود به دنیای سه‌بعدی از یک مرورگر به‌روز استفاده کنید.</p>
            <a className={styles.btn} href={SITE_URL}>
              بازگشت به سایت
            </a>
          </div>
        </div>
      </div>
    );
  }
  if (webgl === null) return <div className={styles.root} />;

  const start = (id: CharacterId) => {
    audio.unlock(); // inside the click: browsers only allow audio after a gesture
    savePref("character", id);
    worldStore.set({ character: id, phase: "play", helpOpen: !hasSeenHelp() });
    setSession((n) => n + 1);
  };

  return (
    <div className={styles.root} onClickCapture={onUiClick} data-reduced-motion={reducedMotion ? "true" : undefined}>
      {phase === "select" ? (
        <CharacterSelector onStart={start} />
      ) : (
        <Suspense fallback={<SessionLoading />}>
          <GameSession key={session} />
        </Suspense>
      )}
    </div>
  );
}

/** Soft click for every UI button. */
function onUiClick(e: React.MouseEvent) {
  audio.unlock();
  if ((e.target as HTMLElement).closest("button, a")) audio.click();
}

function SessionLoading() {
  return (
    <div className={styles.loading}>
      <div className={styles.loadingInner}>
        <div className={styles.spinner} />
        <span>در حال بارگذاری سالن…</span>
      </div>
    </div>
  );
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
