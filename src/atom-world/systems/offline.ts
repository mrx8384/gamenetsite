"use client";

import { createStore } from "../store";

/**
 * Offline & install support (phase 8). Production only, never in the stand-alone preview.
 * The service worker lives at /atom-world/sw.js with scope /atom-world — it never touches the
 * rest of the site. «ذخیره برای اجرا بدون اینترنت» saves every file of the 3D world; later visits
 * then open from the phone even without internet (online features — site data, shared scores —
 * simply wait for the connection).
 */
export const OFFLINE_ENABLED = process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_ATOM_OFFLINE !== "0";

const READY_KEY = "atom-world:offline-ready";

export interface OfflineState {
  supported: boolean;
  /** version of the saved copy ("" = not saved) */
  savedVersion: string;
  currentVersion: string;
  /** MB to download for a full offline copy (files only) */
  sizeMB: number;
  progress: number | null;
  error: string | null;
  online: boolean;
  /** Android / desktop Chrome: install prompt available */
  canInstall: boolean;
  installed: boolean;
  ios: boolean;
}

export const offlineStore = createStore<OfflineState>({
  supported: false,
  savedVersion: "",
  currentVersion: "",
  sizeMB: 0,
  progress: null,
  error: null,
  online: true,
  canInstall: false,
  installed: false,
  ios: false,
});

let installEvent: (Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }) | null = null;
let started = false;

/** Call once on page load. Registers the worker and keeps the offline copy up to date. */
export function initOffline() {
  if (started || typeof window === "undefined") return;
  started = true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const installed = window.matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  offlineStore.set({ ios, installed, online: navigator.onLine });
  window.addEventListener("online", () => offlineStore.set({ online: true }));
  window.addEventListener("offline", () => offlineStore.set({ online: false }));
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installEvent = e as typeof installEvent;
    offlineStore.set({ canInstall: true });
  });
  window.addEventListener("appinstalled", () => offlineStore.set({ installed: true, canInstall: false }));

  const secure = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if (!OFFLINE_ENABLED || !("serviceWorker" in navigator) || !secure) return;
  offlineStore.set({ supported: true, savedVersion: readSaved() });
  navigator.serviceWorker.register("/atom-world/sw.js", { scope: "/atom-world" }).catch(() => offlineStore.set({ supported: false }));
  void fetch("/atom-world/offline-manifest.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then((m: { version: string; assets: { bytes: number }[] } | null) => {
      if (!m) return;
      const bytes = m.assets.reduce((a, b) => a + b.bytes, 0);
      offlineStore.set({ currentVersion: m.version, sizeMB: Math.round((bytes / 1024 / 1024 + 0.9) * 10) / 10 });
      // an earlier saved copy is out of date (the game was updated): refresh it quietly while online
      const saved = readSaved();
      if (saved && saved !== m.version && navigator.onLine) window.setTimeout(() => void saveForOffline(), 8000);
    })
    .catch(() => undefined);
}

function readSaved() {
  try {
    return window.localStorage.getItem(READY_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Downloads every file of the 3D world into the phone (progress in offlineStore). */
export async function saveForOffline(): Promise<boolean> {
  if (offlineStore.get().progress !== null) return false;
  offlineStore.set({ progress: 0, error: null });
  try {
    // load the parts that normally arrive on demand, so their code is saved too
    await Promise.all([
      import("../GameSession"),
      import("../components/SelectorStage"),
      import("../minigames/airHockey/AirHockeyGame"),
      import("../minigames/excavator/ExcavatorGame"),
      import("../minigames/footPool/FootPoolGame"),
    ]);
    const reg = await navigator.serviceWorker.ready;
    const worker = reg.active;
    if (!worker) throw new Error("no worker");
    const extra = [
      ...new Set(
        performance
          .getEntriesByType("resource")
          .map((e) => new URL(e.name, location.href))
          .filter((u) => u.origin === location.origin && u.pathname.startsWith("/_next/static/"))
          .map((u) => u.pathname + u.search),
      ),
    ];
    const version = await new Promise<string>((resolve, reject) => {
      const onMsg = (ev: MessageEvent) => {
        const d = ev.data ?? {};
        if (d.type === "progress") offlineStore.set({ progress: d.done / d.total });
        if (d.type === "cached") {
          navigator.serviceWorker.removeEventListener("message", onMsg);
          if (d.failed) reject(new Error(`${d.failed} files failed`));
          else resolve(d.version);
        }
      };
      navigator.serviceWorker.addEventListener("message", onMsg);
      worker.postMessage({ type: "cache-all", extra });
    });
    try {
      window.localStorage.setItem(READY_KEY, version);
    } catch {
      /* private mode: the copy is saved, just not remembered as such */
    }
    offlineStore.set({ progress: null, savedVersion: version });
    return true;
  } catch {
    offlineStore.set({ progress: null, error: "ذخیره کامل نشد؛ اتصال اینترنت را بررسی کنید و دوباره امتحان کنید." });
    return false;
  }
}

/** Shows the browser's «install app» dialog (Android / desktop Chrome). */
export async function promptInstall() {
  if (!installEvent) return false;
  await installEvent.prompt();
  const choice = await installEvent.userChoice.catch(() => ({ outcome: "dismissed" }));
  installEvent = null;
  offlineStore.set({ canInstall: false, installed: choice.outcome === "accepted" });
  return choice.outcome === "accepted";
}
