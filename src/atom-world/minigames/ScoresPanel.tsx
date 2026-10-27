"use client";

import { useDialogFocus } from "../components/useDialogFocus";
import { useEffect, useRef, useState } from "react";
import type { MiniGameId } from "../data/machines";
import { useWorld, worldStore } from "../store";
import ui from "../styles/atomWorld.module.css";
import { ACHIEVEMENTS, earned, rewardStore } from "./achievements";
import styles from "./minigames.module.css";
import { MINI_GAMES } from "./registry";
import { loadRewards } from "./rewards";
import { RewardsTab, useRewards } from "./RewardsPanel";
import { gameTitle, ScoreTable } from "./ScoreBoard";
import { fa } from "./types";

/** Menu → «امتیازها و دستاوردها»: top scores per mini-game and the achievement list. */
export function ScoresPanel() {
  const open = useWorld((s) => s.scoresOpen);
  if (!open) return null;
  return <Body />;
}

function Body() {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);
  const games = (Object.keys(MINI_GAMES) as MiniGameId[]).filter((g) => !MINI_GAMES[g].menu);
  const [tab, setTab] = useState<MiniGameId | "achievements" | "points">(games[0]);
  const [local] = useState(() => earned());
  const account = useRewards();
  // earned on this device or on the site account
  const have = (id: string) => !!local[id] || account.achievements.includes(id);
  const pointsOf = (id: string, dflt: number) => account.achievementPoints[id] ?? dflt;
  const rewards = rewardStore.get().byId;
  const close = () => worldStore.set({ scoresOpen: false });
  const count = ACHIEVEMENTS.filter((a) => have(a.id)).length;
  useEffect(() => {
    void loadRewards();
  }, []);

  return (
    <div className={ui.backdrop} onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <section className={ui.panel} ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="aw-scores-title">
        <div className={ui.panelHead}>
          <h2 id="aw-scores-title" className={ui.panelTitle}>
            🏆 امتیازها و دستاوردها
          </h2>
          <button type="button" className={`${ui.btn} ${ui.iconBtn}`} aria-label="بستن" onClick={close} autoFocus>
            ✕
          </button>
        </div>
        <div className={styles.tabs} role="tablist" aria-label="بخش‌ها">
          {games.map((g) => (
            <button key={g} type="button" role="tab" aria-selected={tab === g} className={ui.btn} onClick={() => setTab(g)}>
              {gameTitle(g)}
            </button>
          ))}
          <button type="button" role="tab" aria-selected={tab === "achievements"} className={ui.btn} onClick={() => setTab("achievements")}>
            🎖️ دستاوردها ({fa(count)}/{fa(ACHIEVEMENTS.length)})
          </button>
          {account.available && (
            <button type="button" role="tab" aria-selected={tab === "points"} className={ui.btn} onClick={() => setTab("points")}>
              ⭐ امتیاز و جایزه
            </button>
          )}
        </div>
        <div role="tabpanel">
          {tab === "points" ? (
            <RewardsTab />
          ) : tab === "achievements" ? (
            <ul className={styles.achGrid}>
              {ACHIEVEMENTS.map((a) => {
                const got = have(a.id);
                const secret = a.hidden && !got;
                return (
                  <li key={a.id} className={got ? undefined : styles.achLocked}>
                    <span className={styles.achEmoji} aria-hidden>
                      {secret ? "❔" : a.emoji}
                    </span>
                    <div>
                      <strong>
                        {got ? "" : "🔒 "}
                        {secret ? "دستاورد مخفی" : a.title}
                      </strong>
                      <div className={ui.panelSub}>
                        {got ? "به‌دست آمده ✓" : secret ? `${a.game ? gameTitle(a.game) : "دنیای اتم"} — با بازی کردن پیدایش کنید.` : a.hint}
                        {account.available && ` · ⭐ ${fa(pointsOf(a.id, a.points))}`}
                      </div>
                      {got && rewards[a.id] && <div className={styles.reward}>🎁 {rewards[a.id]}</div>}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <>
              <ScoreTable game={tab} />
              <div className={ui.panelActions}>
                <button type="button" className={`${ui.btn} ${ui.btnPink}`} onClick={() => worldStore.set({ scoresOpen: false, miniGame: tab })}>
                  🎮 بازی {MINI_GAMES[tab].title}
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
