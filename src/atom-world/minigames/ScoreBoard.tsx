"use client";

import { useEffect, useState } from "react";
import type { MiniGameId } from "../data/machines";
import ui from "../styles/atomWorld.module.css";
import { type Achievement, rewardStore } from "./achievements";
import styles from "./minigames.module.css";
import { MINI_GAMES } from "./registry";
import { addLocal, cleanName, loadName, localTop, remoteTop, saveName, type ScoreEntry, sharedScores, submitRemote } from "./scores";
import { fa, type MiniGameResult } from "./types";

/** Top-10 table: everyone's (site) when configured, else this device's. */
export function ScoreTable({ game, highlight, refresh = 0 }: { game: MiniGameId; highlight?: number; refresh?: number }) {
  const [list, setList] = useState<ScoreEntry[]>(() => localTop(game));
  const [shared, setShared] = useState(false);
  useEffect(() => {
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- re-read the device table after a submit
    setList(localTop(game));
    void remoteTop(game).then((r) => {
      if (live && r) {
        setList(r);
        setShared(true);
      }
    });
    return () => {
      live = false;
    };
  }, [game, refresh]);

  return (
    <div className={styles.board}>
      <div className={styles.boardHead}>{shared ? "جدول امتیاز همهٔ بازیکنان" : "جدول امتیاز این دستگاه"}</div>
      {list.length === 0 ? (
        <p className={styles.note}>هنوز امتیازی ثبت نشده است.</p>
      ) : (
        <ol className={styles.boardList}>
          {list.map((e, i) => (
            <li key={`${e.at}-${i}`} className={highlight === e.at ? styles.boardMine : undefined}>
              <span className={styles.boardRank}>{fa(i + 1)}</span>
              <span className={styles.boardName}>{e.name}</span>
              <span className={styles.boardDetail}>{e.detail}</span>
              <strong>{fa(e.score)}</strong>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Name field + «ثبت امتیاز», then the table with the new row highlighted. */
export function SubmitScore({ game, result }: { game: MiniGameId; result: MiniGameResult }) {
  const [name, setName] = useState(() => loadName());
  const [saved, setSaved] = useState<{ at: number; rank: number | null; remote: boolean | null } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const canSave = result.score > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = cleanName(name) || "بازیکن";
    saveName(n);
    const entry: ScoreEntry = { name: n, score: Math.round(result.score), detail: result.detail, at: Date.now() };
    const rank = addLocal(game, entry);
    setSaved({ at: entry.at, rank, remote: null });
    setRefresh((r) => r + 1);
    if (sharedScores()) {
      const ok = await submitRemote(game, entry, result.stats);
      setSaved({ at: entry.at, rank, remote: ok });
      setRefresh((r) => r + 1);
    }
  };

  return (
    <div>
      {canSave && !saved && (
        <form className={styles.nameForm} onSubmit={submit}>
          <label htmlFor="aw-player-name">نام شما برای جدول امتیاز</label>
          <div className={styles.nameRow}>
            <input id="aw-player-name" className={styles.nameInput} value={name} maxLength={20} autoComplete="nickname" placeholder="مثلاً علی" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
            <button type="submit" className={`${ui.btn} ${ui.btnPrimary}`}>
              ثبت امتیاز
            </button>
          </div>
        </form>
      )}
      {saved && (
        <p className={styles.best} role="status">
          {saved.rank ? `ثبت شد — رتبهٔ ${fa(saved.rank)} در این دستگاه` : "ثبت شد (به ده رتبهٔ اول نرسید)"}
          {saved.remote === false ? " · ارسال به سایت انجام نشد" : ""}
        </p>
      )}
      <ScoreTable game={game} highlight={saved?.at} refresh={refresh} />
    </div>
  );
}

/** Achievements earned this round, with the club's prize text when there is one. */
export function NewAchievements({ list }: { list: Achievement[] }) {
  const rewards = rewardStore.get().byId;
  if (!list.length) return null;
  return (
    <div className={styles.achNew} role="status">
      {list.map((a) => (
        <div key={a.id} className={styles.achItem}>
          <span className={styles.achEmoji} aria-hidden>
            {a.emoji}
          </span>
          <div>
            <strong>دستاورد جدید: {a.title}</strong>
            {rewards[a.id] && <div className={styles.reward}>🎁 {rewards[a.id]} — این صفحه را به پیشخوان مجموعه نشان دهید.</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

export const gameTitle = (g: MiniGameId) => `${MINI_GAMES[g].emoji} ${MINI_GAMES[g].title}`;
