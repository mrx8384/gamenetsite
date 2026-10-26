"use client";

import { useDialogFocus } from "./useDialogFocus";
import { useRef, useSyncExternalStore } from "react";
import { SITE_URL } from "../config";
import { boardTournaments, eventsStore, FORMAT_LABEL, formatStart, relativeStart, STATUS_LABEL, type TournamentItem } from "../data/events";
import { fa } from "../minigames/types";
import { useWorld, worldStore } from "../store";
import styles from "../styles/atomWorld.module.css";

const siteHref = (path: string) => `${SITE_URL.replace(/\/$/, "")}${path}`;
const useEvents = () => useSyncExternalStore(eventsStore.subscribe, eventsStore.get, eventsStore.get);

/** Tournaments and news from the site, with links to sign up / read more on the site. */
export function EventsPanel() {
  const open = useWorld((s) => s.eventsOpen);
  if (!open) return null;
  return <Body />;
}

function Body() {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);
  const ev = useEvents();
  const list = boardTournaments(ev.tournaments);
  const close = () => worldStore.set({ eventsOpen: false });

  return (
    <div className={styles.backdrop} onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <section className={styles.panel} ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="aw-events-title" style={{ maxWidth: 620 }}>
        <div className={styles.panelHead}>
          <div>
            <h2 id="aw-events-title" className={styles.panelTitle}>
              📣 تورنومنت‌ها و رویدادها
            </h2>
            <div className={styles.panelSub}>از سایت ATOM GAME CLUB</div>
          </div>
          <button type="button" className={`${styles.btn} ${styles.iconBtn}`} aria-label="بستن" onClick={close} autoFocus>
            ✕
          </button>
        </div>

        {!ev.loaded ? (
          <p className={styles.desc}>در حال دریافت از سایت…</p>
        ) : list.length === 0 ? (
          <p className={styles.desc}>فعلاً تورنومنتی از سایت دریافت نشده است. فهرست کامل تورنومنت‌ها را در سایت ببینید.</p>
        ) : (
          <ul className={styles.eventList}>
            {list.map((t) => (
              <TournamentRow key={t.slug} t={t} />
            ))}
          </ul>
        )}

        {ev.news.length > 0 && (
          <>
            <div className={styles.sectionLabel}>تازه‌های مجموعه</div>
            <ul className={styles.newsList}>
              {ev.news.slice(0, 5).map((n) => (
                <li key={n.slug}>
                  <a href={siteHref(`/news/${n.slug}`)}>
                    <strong>{n.title}</strong>
                    {n.excerpt && <span className={styles.panelSub}>{n.excerpt}</span>}
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className={styles.panelActions}>
          <a className={styles.btn} href={siteHref("/tournaments")}>
            همهٔ تورنومنت‌ها در سایت ↗
          </a>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={close}>
            بازگشت به بازی
          </button>
        </div>
      </section>
    </div>
  );
}

function TournamentRow({ t }: { t: TournamentItem }) {
  const full = t.maxParticipants !== null && t.participantCount >= t.maxParticipants;
  const rel = relativeStart(t.startsAt);
  return (
    <li className={styles.eventItem} data-status={t.status}>
      <div className={styles.eventTop}>
        <span className={styles.eventBadge}>{STATUS_LABEL[t.status]}</span>
        <strong className={styles.eventName}>{t.name}</strong>
      </div>
      <div className={styles.panelSub}>
        🎮 {t.game}
        {t.platform ? ` · ${t.platform}` : ""} · {FORMAT_LABEL[t.format]}
      </div>
      <div className={styles.eventMeta}>
        🗓️ {formatStart(t.startsAt)}
        {rel && t.status !== "COMPLETED" ? ` (${rel})` : ""}
      </div>
      <div className={styles.eventMeta}>
        👥 {fa(t.participantCount)}
        {t.maxParticipants ? ` از ${fa(t.maxParticipants)} نفر` : " نفر"}
        {full ? " — ظرفیت تکمیل" : ""} · برگزارکننده: {t.organizerName}
      </div>
      {t.prize && <div className={styles.eventPrize}>🏆 جایزه: {t.prize}</div>}
      <a className={`${styles.btn} ${t.status === "REGISTRATION" && !full ? styles.btnPrimary : ""}`} href={siteHref(`/tournaments/${t.slug}`)}>
        {t.status === "REGISTRATION" && !full ? "ثبت‌نام در سایت ↗" : t.status === "IN_PROGRESS" ? "جدول و نتایج ↗" : "جزئیات در سایت ↗"}
      </a>
    </li>
  );
}
