"use client";

import { useState, useSyncExternalStore } from "react";
import ui from "../styles/atomWorld.module.css";
import styles from "../minigames/minigames.module.css";
import { cleanName, loadName, saveName } from "../minigames/scores";
import { ERROR_TEXT, type OnlineGame, RoomLink } from "./connection";

export function useLink(link: RoomLink | null) {
  const store = link?.state;
  return useSyncExternalStore(
    (cb) => store?.subscribe(cb) ?? (() => {}),
    () => store?.get() ?? null,
    () => store?.get() ?? null,
  );
}

/** Create a room (shows the code to share) or join one with a friend's code. */
export function Lobby({ game, link, setLink, onStart, joinCode }: { game: OnlineGame; link: RoomLink | null; setLink: (l: RoomLink | null) => void; onStart: () => void; joinCode?: string }) {
  const [name, setName] = useState(() => loadName());
  const [code, setCode] = useState(joinCode ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const st = useLink(link);

  const me = () => {
    const n = cleanName(name) || "بازیکن";
    saveName(n);
    return n;
  };
  const run = async (fn: () => Promise<RoomLink>) => {
    setBusy(true);
    setError(null);
    try {
      setLink(await fn());
    } catch (e) {
      setError(ERROR_TEXT[(e as Error).message] ?? "اتصال برقرار نشد؛ دوباره امتحان کنید.");
    } finally {
      setBusy(false);
    }
  };

  if (!link || !st) {
    return (
      <div className={styles.lobby}>
        <label className={styles.nameForm}>
          نام شما
          <input className={styles.nameInput} value={name} maxLength={20} placeholder="مثلاً علی" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
        </label>
        <div className={styles.cardActions}>
          <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} disabled={busy} onClick={() => run(() => RoomLink.create(game, me()))}>
            ساخت اتاق و دعوت دوست
          </button>
        </div>
        <div className={styles.lobbyOr}>یا</div>
        <label className={styles.nameForm}>
          کد اتاقی که دوستتان فرستاده
          <div className={styles.nameRow}>
            <input
              className={`${styles.nameInput} ${styles.codeInput}`}
              value={code}
              inputMode="numeric"
              autoComplete="off"
              maxLength={5}
              placeholder="۵ رقم"
              onChange={(e) => setCode(toLatinDigits(e.target.value).replace(/\D/g, "").slice(0, 5))}
              onKeyDown={(e) => e.stopPropagation()}
            />
            <button type="button" className={ui.btn} disabled={busy || code.length !== 5} onClick={() => run(() => RoomLink.join(code, me()))}>
              ورود
            </button>
          </div>
        </label>
        {error && (
          <p className={styles.lobbyError} role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (st.status === "error") {
    return (
      <div className={styles.lobby}>
        <p className={styles.lobbyError} role="alert">
          {st.error}
        </p>
        <button type="button" className={ui.btn} onClick={() => (link.close(), setLink(null))}>
          تلاش دوباره
        </button>
      </div>
    );
  }

  const share = async () => {
    const text = `بیا با هم در دنیای اتم بازی کنیم! کد اتاق: ${st.code}`;
    const url = `${location.origin}/atom-world?room=${st.code}&game=${st.game}`;
    try {
      if (navigator.share) await navigator.share({ title: "دنیای اتم", text, url });
      else await navigator.clipboard.writeText(`${text}\n${url}`);
    } catch {
      /* cancelled */
    }
  };

  return (
    <div className={styles.lobby} aria-live="polite">
      {st.seat === 0 && (
        <>
          <div className={styles.lobbyCodeLabel}>کد اتاق را برای دوستتان بفرستید</div>
          <div className={styles.lobbyCode} dir="ltr">
            {st.code}
          </div>
          <button type="button" className={ui.btn} onClick={() => void share()}>
            📤 ارسال دعوت
          </button>
        </>
      )}
      {st.status === "waiting" && <p className={styles.note}>منتظر ورود دوست شما…</p>}
      {st.status === "peer-offline" && <p className={styles.lobbyError}>ارتباط دوست شما قطع شده است؛ منتظر بمانید تا برگردد.</p>}
      {st.status === "ready" && st.peerName && <p className={styles.best}>✓ {st.seat === 0 ? `${st.peerName} وارد اتاق شد.` : `به اتاق ${st.peerName} وصل شدید.`}</p>}
      {st.status === "ready" &&
        (st.seat === 0 ? (
          <button
            type="button"
            className={`${ui.btn} ${ui.btnPrimary}`}
            onClick={() => {
              link.send({ t: "start" });
              onStart();
            }}
          >
            شروع بازی
          </button>
        ) : (
          <p className={styles.note}>منتظر شروع بازی توسط {st.peerName}…</p>
        ))}
    </div>
  );
}

function toLatinDigits(s: string) {
  return s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}
