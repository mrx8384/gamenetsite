"use client";

import { useDialogFocus } from "./useDialogFocus";
import { useEffect, useRef, useState } from "react";
import { useMachine } from "../data/machines";
import { MINI_GAMES } from "../minigames/registry";
import { useWorld, worldStore } from "../store";
import styles from "../styles/atomWorld.module.css";
import { SITE_URL } from "../config";

/** Path on the main site (the game lives on the same site at /atom-world). */
function siteHref(path: string) {
  return `${SITE_URL.replace(/\/$/, "")}${path}`;
}

/** Machine info window: name, real photos, description, tariff (only if registered), close. */
export function InteractionPanel() {
  const panel = useWorld((s) => s.panel);
  if (!panel) return null;
  return <PanelBody key={panel.id} machineId={panel.machineId} />;
}

function PanelBody({ machineId }: { machineId: string }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);
  const m = useMachine(machineId);
  const [photo, setPhoto] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => closeRef.current?.focus(), []);
  if (!m) return null;
  const close = () => worldStore.set({ panel: null });

  return (
    <div className={styles.backdrop} onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <section className={styles.panel} ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="aw-machine-title">
        <div className={styles.panelHead}>
          <div>
            <h2 id="aw-machine-title" className={styles.panelTitle}>
              {m.emoji} {m.name}
            </h2>
            <div className={styles.panelSub}>ATOM GAME CLUB</div>
          </div>
          <button ref={closeRef} type="button" className={`${styles.btn} ${styles.iconBtn}`} aria-label="بستن" onClick={close}>
            ✕
          </button>
        </div>
        <div className={styles.panelGrid}>
          {m.photos.length > 0 && (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.photo} src={m.photos[photo].src} alt={m.photos[photo].alt} />
              {m.photos.length > 1 && (
                <div className={styles.thumbs}>
                  {m.photos.map((p, i) => (
                    <button key={p.src} type="button" className={styles.thumb} aria-pressed={i === photo} aria-label={p.alt} onClick={() => setPhoto(i)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.src} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div>
            <p className={styles.desc}>{m.description}</p>
            {!m.noPrice && (
              <div className={styles.price}>
                <span>تعرفه</span>
                {m.price ? <strong>{m.price}</strong> : <span>تعرفهٔ این بازی هنوز در سایت ثبت نشده است. برای اطلاع از تعرفه با مجموعه تماس بگیرید.</span>}
              </div>
            )}
          </div>
        </div>
        <div className={styles.panelActions}>
          {m.links?.map((l) => (
            <a key={l.href} className={styles.btn} href={siteHref(l.href)}>
              {l.label} ↗
            </a>
          ))}
          {!m.noPrice && !m.travel && (
            <button type="button" className={styles.btn} onClick={() => worldStore.set({ panel: null, booking: { machineId: m.id } })}>
              📅 رزرو و ساعت کاری
            </button>
          )}
          {m.miniGame && (
            <button type="button" className={`${styles.btn} ${styles.btnPink}`} onClick={() => worldStore.set({ panel: null, miniGame: m.miniGame, miniGameFrom: worldStore.get().panel?.id ?? null })}>
              🎮 مینی‌گیم {MINI_GAMES[m.miniGame].title}
            </button>
          )}
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={close}>
            بازگشت به بازی
          </button>
        </div>
      </section>
    </div>
  );
}
