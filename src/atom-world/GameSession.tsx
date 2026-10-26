"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";
import { GameCanvas } from "./components/GameCanvas";
import { GameHUD } from "./components/GameHUD";
import { GameMenu } from "./components/GameMenu";
import { InteractionPanel } from "./components/InteractionPanel";
import { MachineList } from "./components/MachineList";
import { MiniMap } from "./components/MiniMap";
import { MobileControls } from "./components/MobileControls";
import { releaseCharacterModels } from "./characters/GltfCharacter";
import { loadRemoteMachines } from "./data/remoteMachines";
import { MiniGameHost } from "./minigames/MiniGameHost";
import { ScoresPanel } from "./minigames/ScoresPanel";
import { BookingPanel } from "./booking/BookingPanel";
import { EventsPanel } from "./components/EventsPanel";
import { boardTournaments, eventsStore, loadEvents } from "./data/events";
import { closeHelp, savePref, useWorld, worldStore } from "./store";
import { releasePhotoTextures } from "./systems/AssetLoader";
import { audio } from "./systems/AudioManager";
import { KeyboardInput } from "./systems/input";
import { onRelease } from "./systems/release";
import { createRuntime } from "./systems/runtime";
import styles from "./styles/atomWorld.module.css";

// leaving /atom-world: drop cached models and textures so the site gets its memory back
onRelease(() => {
  releasePhotoTextures();
  releaseCharacterModels();
});

/** The playable world (3D scene + overlays). Loaded on demand: three.js is not in the first download. */
export default function GameSession() {
  const [runtime] = useState(() => ({ current: createRuntime() }));
  const ready = useWorld((s) => s.ready);
  const progress = useWorld((s) => s.loadProgress);
  const contextLost = useWorld((s) => s.contextLost);

  // loading progress of all textures / models (three.js default loading manager)
  useEffect(() => {
    const m = THREE.DefaultLoadingManager;
    const prev = m.onProgress;
    m.onProgress = (_url, loaded, total) => worldStore.set({ loadProgress: total ? loaded / total : 0 });
    return () => {
      m.onProgress = prev;
    };
  }, []);

  // sound settings, ambience and info-panel chimes
  useEffect(() => {
    const apply = () => {
      const st = worldStore.get();
      audio.setEnabled(st.sound);
      audio.setVolume(st.volume);
    };
    apply();
    audio.startAmbient();
    let panel = worldStore.get().panel;
    let mini = worldStore.get().miniGame;
    const unsub = worldStore.subscribe(() => {
      apply();
      const st = worldStore.get();
      if (st.panel && !panel) audio.openPanel();
      if (!st.panel && panel && !st.miniGame) audio.closePanel();
      panel = st.panel;
      // the hall ambience stops while a mini-game is open
      if (st.miniGame && !mini) audio.stopAmbient();
      if (!st.miniGame && mini) audio.startAmbient();
      mini = st.miniGame;
    });
    const unlock = () => {
      audio.unlock();
      audio.startAmbient();
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      unsub();
      audio.stopAmbient();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // tariffs / descriptions / photos edited in the site's admin panel (if configured)
  useEffect(() => {
    void loadRemoteMachines();
    if (!navigator.onLine) worldStore.set({ toast: "اینترنت وصل نیست؛ نسخهٔ ذخیره‌شدهٔ دنیای اتم اجرا شد." });
  }, []);

  // tournaments & news from the site; one short notice per visit when a registration is open
  useEffect(() => {
    void loadEvents().then(() => {
      const open = boardTournaments(eventsStore.get().tournaments).find((t) => t.status === "REGISTRATION");
      if (!open) return;
      try {
        if (window.sessionStorage.getItem("atom-world:events-notice") === open.slug) return;
        window.sessionStorage.setItem("atom-world:events-notice", open.slug);
      } catch {
        /* private mode: show it anyway */
      }
      window.setTimeout(() => worldStore.set({ toast: `📣 ثبت‌نام تورنومنت «${open.name}» باز است — تابلوی رویدادها کنار پیشخوان.` }), 4000);
    });
  }, []);

  // invite link: open the friend's game lobby as soon as the hall is ready
  useEffect(() => {
    if (!ready) return;
    const p = worldStore.get().pendingRoom;
    if (p) worldStore.set({ miniGame: p.game, helpOpen: false });
  }, [ready]);

  useEffect(() => {
    const kb = new KeyboardInput(
      runtime.current.input,
      () => {
        const s = worldStore.get();
        if (s.miniGame) return; // the mini-game handles Esc itself (pause)
        if (s.panel) worldStore.set({ panel: null });
        else if (s.scoresOpen) worldStore.set({ scoresOpen: false });
        else if (s.booking) worldStore.set({ booking: null });
        else if (s.eventsOpen) worldStore.set({ eventsOpen: false });
        else if (s.mapOpen) worldStore.set({ mapOpen: false, mapFocus: null });
        else if (s.listOpen) worldStore.set({ listOpen: false });
        else if (s.helpOpen) closeHelp();
        else worldStore.set({ menuOpen: !s.menuOpen });
      },
      () => {
        const s = worldStore.get();
        return s.menuOpen || s.mapOpen || s.listOpen || s.panel !== null || s.miniGame !== null || s.scoresOpen || s.booking !== null || s.eventsOpen;
      },
      // M: big map
      () => worldStore.set((s) => ({ mapOpen: !s.mapOpen, mapFocus: null })),
    );
    kb.attach();
    // ?debug=1 exposes the runtime for automated tests (read-only use)
    if (new URLSearchParams(window.location.search).has("debug")) {
      (window as unknown as { __atomWorld?: unknown }).__atomWorld = runtime.current;
      (window as unknown as { __atomAudio?: unknown }).__atomAudio = audio;
    }
    return () => {
      kb.detach();
      worldStore.set({ nearby: null, panel: null, menuOpen: false, mapOpen: false, miniGame: null });
    };
  }, [runtime]);

  return (
    <>
      <GameCanvas runtime={runtime} />
      <GameHUD />
      <MiniMap />
      <MobileControls inputRef={{ current: runtime.current.input }} />
      <InteractionPanel />
      <GameMenu />
      <MachineList />
      <ScoresPanel />
      <BookingPanel />
      <EventsPanel />
      <MiniGameHost />
      <Toast />
      {!ready && (
        <div className={styles.loading}>
          <div className={styles.loadingInner}>
            <div className={styles.spinner} />
            <span>در حال بارگذاری سالن…</span>
            <div className={styles.progress} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
              <div style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          </div>
        </div>
      )}
      {contextLost && (
        <div className={styles.loading}>
          <div className={styles.error}>
            <p>نمایش سه‌بعدی به‌دلیل کمبود حافظهٔ گرافیکی دستگاه متوقف شد. با کیفیت سبک‌تر دوباره بارگذاری کنید.</p>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => {
                savePref("quality", "low");
                window.location.reload();
              }}
            >
              بارگذاری دوباره
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Short message that hides itself after a few seconds. */
function Toast() {
  const toast = useWorld((s) => s.toast);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => worldStore.set({ toast: null }), 4500);
    return () => window.clearTimeout(t);
  }, [toast]);
  if (!toast) return null;
  return (
    <div className={styles.toast} role="status">
      {toast}
    </div>
  );
}

