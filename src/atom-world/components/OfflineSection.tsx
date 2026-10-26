"use client";

import { useSyncExternalStore } from "react";
import { fa } from "../minigames/types";
import styles from "../styles/atomWorld.module.css";
import { offlineStore, promptInstall, saveForOffline } from "../systems/offline";

const useOffline = () => useSyncExternalStore(offlineStore.subscribe, offlineStore.get, offlineStore.get);

/** Menu section: save the world for offline use, install as an app on the phone. */
export function OfflineSection() {
  const o = useOffline();
  const ready = !!o.savedVersion && o.savedVersion === o.currentVersion;
  const stale = !!o.savedVersion && !!o.currentVersion && o.savedVersion !== o.currentVersion;
  if (!o.supported && !o.canInstall && !o.ios) return null;

  return (
    <>
      <div className={styles.sectionLabel}>اجرا بدون اینترنت</div>
      {!o.online && <p className={styles.offlineNote}>اینترنت وصل نیست؛ نسخهٔ ذخیره‌شده اجرا شده است.</p>}
      {o.supported &&
        (o.progress !== null ? (
          <div className={styles.offlineBox} role="status">
            در حال ذخیره… {fa(Math.round(o.progress * 100))}٪
            <div className={styles.progress} style={{ width: "100%" }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(o.progress * 100)}>
              <div style={{ width: `${Math.round(o.progress * 100)}%` }} />
            </div>
          </div>
        ) : ready ? (
          <p className={styles.offlineBox}>✓ دنیای اتم روی این دستگاه ذخیره شده و بدون اینترنت هم باز می‌شود.</p>
        ) : (
          <button type="button" className={styles.btn} disabled={!o.online} onClick={() => void saveForOffline()}>
            💾 {stale ? "به‌روزرسانی نسخهٔ ذخیره‌شده" : "ذخیره برای اجرا بدون اینترنت"}
            {o.sizeMB > 0 ? ` (حدود ${fa(o.sizeMB, 1)} مگابایت)` : ""}
          </button>
        ))}
      {o.error && (
        <p className={styles.offlineNote} role="alert">
          {o.error}
        </p>
      )}
      {!o.installed && o.canInstall && (
        <button type="button" className={styles.btn} onClick={() => void promptInstall()}>
          📲 نصب روی صفحهٔ اصلی گوشی
        </button>
      )}
      {!o.installed && !o.canInstall && o.ios && <p className={styles.offlineNote}>📲 برای نصب در آیفون: در سافاری دکمهٔ اشتراک‌گذاری ⬆️ و بعد «Add to Home Screen» را بزنید.</p>}
    </>
  );
}
