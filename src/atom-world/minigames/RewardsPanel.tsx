"use client";

import { useState, useSyncExternalStore } from "react";
import ui from "../styles/atomWorld.module.css";
import styles from "./minigames.module.css";
import { CHANNEL_HOWTO, CHANNEL_LABEL, type MyCard, redeem, type RedeemError, rewardsStore } from "./rewards";
import { fa } from "./types";

export const useRewards = () => useSyncExternalStore(rewardsStore.subscribe, rewardsStore.get, rewardsStore.get);

const ERR: Record<RedeemError, string> = {
  points: "امتیاز شما برای این کارت کافی نیست.",
  limit: "سقف دریافت این کارت برای شما فعلاً پر شده است.",
  inactive: "این کارت دیگر فعال نیست.",
  login: "برای گرفتن کارت دوباره وارد حساب سایت شوید.",
  error: "گرفتن کارت ممکن نشد؛ کمی بعد دوباره امتحان کنید.",
};

const STATUS: Record<MyCard["status"], string> = { ACTIVE: "قابل استفاده", USED: "استفاده شده", EXPIRED: "منقضی شده", CANCELLED: "لغو شده" };

const date = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("fa-IR-u-ca-persian", { year: "numeric", month: "long", day: "numeric" });
};

/** «⭐ امتیاز و جایزه»: points on the site account, the club's discount cards and the player's own cards. */
export function RewardsTab() {
  const r = useRewards();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [fresh, setFresh] = useState<MyCard | null>(null);

  if (r.loading && !r.available) return <p className={ui.panelSub}>در حال دریافت…</p>;
  if (!r.available) return <p className={ui.panelSub}>امتیاز و جایزه فقط روی سایت اتم گیم کلاب در دسترس است.</p>;
  if (!r.loggedIn)
    return (
      <div className={styles.rewardsBox}>
        <p>با هر دور بازی و هر دستاورد امتیاز بگیرید و با امتیازها کارت تخفیف اتم بگیرید. امتیازها در حساب شما در سایت ذخیره می‌شود.</p>
        <a className={`${ui.btn} ${ui.btnPink}`} href={r.loginUrl}>
          ورود به حساب سایت
        </a>
      </div>
    );
  if (!r.enabled) return <p className={ui.panelSub}>جمع کردن امتیاز فعلاً از طرف مجموعه خاموش است.</p>;

  const get = async (id: string) => {
    setBusy(true);
    setMsg(null);
    const res = await redeem(id);
    setBusy(false);
    setConfirm(null);
    if ("error" in res) setMsg(ERR[res.error]);
    else setFresh(res.card);
  };

  return (
    <div className={styles.rewardsBox}>
      <div className={styles.balance} role="status">
        ⭐ امتیاز شما: <strong>{fa(r.balance)}</strong>
      </div>
      <p className={ui.panelSub}>
        هر دور بازی {fa(r.perRound)} امتیاز (تا {fa(r.roundsPerDay)} دور در روز؛ امروز {fa(Math.min(r.roundsToday, r.roundsPerDay))} دور) — و هر دستاورد یک بار امتیاز خودش را دارد.
      </p>
      {fresh && (
        <div className={styles.cardFresh} role="alert">
          <strong>🎟️ کارت شما آماده است: {fresh.title}</strong>
          <div className={styles.cardCode} dir="ltr">
            {fresh.code}
          </div>
          <div>{CHANNEL_HOWTO[fresh.channel]}</div>
          <div className={ui.panelSub}>اعتبار تا {date(fresh.expiresAt)}</div>
        </div>
      )}
      {msg && (
        <p className={styles.reward} role="alert">
          {msg}
        </p>
      )}
      <h3 className={styles.rewardsHead}>کارت‌های تخفیف</h3>
      {r.cards.length === 0 ? (
        <p className={ui.panelSub}>هنوز کارتی از طرف مجموعه تعریف نشده است.</p>
      ) : (
        <ul className={styles.cardList}>
          {r.cards.map((c) => {
            const enough = r.balance >= c.pointsCost;
            return (
              <li key={c.id} className={styles.cardItem}>
                <div>
                  <strong>
                    🎟️ {c.title} — {fa(c.discountPercent)}٪ تخفیف
                  </strong>
                  {c.description && <div className={ui.panelSub}>{c.description}</div>}
                  <div className={ui.panelSub}>
                    {CHANNEL_LABEL[c.channel]} · اعتبار {fa(c.validDays)} روز
                  </div>
                </div>
                {confirm === c.id ? (
                  <div className={styles.cardActions}>
                    <button type="button" className={`${ui.btn} ${ui.btnPink}`} disabled={busy} onClick={() => get(c.id)}>
                      {busy ? "…" : `بله، ${fa(c.pointsCost)} امتیاز کم شود`}
                    </button>
                    <button type="button" className={ui.btn} disabled={busy} onClick={() => setConfirm(null)}>
                      انصراف
                    </button>
                  </div>
                ) : (
                  <button type="button" className={ui.btn} disabled={!enough} onClick={() => setConfirm(c.id)} title={enough ? undefined : "امتیاز کافی نیست"}>
                    ⭐ {fa(c.pointsCost)} — گرفتن کارت
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <h3 className={styles.rewardsHead}>کارت‌های من</h3>
      {r.mine.length === 0 ? (
        <p className={ui.panelSub}>هنوز کارتی نگرفته‌اید.</p>
      ) : (
        <ul className={styles.cardList}>
          {r.mine.map((c) => (
            <li key={c.code} className={`${styles.cardItem} ${c.status === "ACTIVE" ? "" : styles.achLocked}`}>
              <div>
                <strong>
                  {c.title} — {fa(c.discountPercent)}٪
                </strong>
                <div className={styles.cardCode} dir="ltr">
                  {c.code}
                </div>
                <div className={ui.panelSub}>
                  {STATUS[c.status]}
                  {c.status === "ACTIVE" ? ` · تا ${date(c.expiresAt)} · ${CHANNEL_HOWTO[c.channel]}` : ""}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
