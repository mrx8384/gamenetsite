"use client";

import { useDialogFocus } from "../components/useDialogFocus";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { MiniGameId } from "../data/machines";
import { useWorld, worldStore } from "../store";
import { onlineAvailable, type OnlineGame, type RoomLink } from "../online/connection";
import { Lobby } from "../online/Lobby";
import { audio } from "../systems/AudioManager";
import ui from "../styles/atomWorld.module.css";
import styles from "./minigames.module.css";
import { GAME_COMPONENTS, MINI_GAMES } from "./registry";
import { ACHIEVEMENTS, type Achievement, recordRound } from "./achievements";
import { loadRewards, reportRound, type RoundReward, rewardsStore } from "./rewards";
import { NewAchievements, SubmitScore } from "./ScoreBoard";
import { OpponentIntro } from "./OpponentIntro";
import { localTop } from "./scores";
import { type Difficulty, fa, type HudItem, type MiniGameResult } from "./types";

type Phase = "intro" | "opponent" | "countdown" | "play" | "result";

const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: "آسان", normal: "معمولی", hard: "سخت" };

const bestScore = (id: MiniGameId) => localTop(id)[0]?.score ?? 0;

/** Full-screen mini-game layer. While it is open the 3D world is paused (see GameCanvas). */
export function MiniGameHost() {
  const id = useWorld((s) => s.miniGame);
  if (!id) return null;
  return <Host key={id} id={id} />;
}

function Host({ id }: { id: MiniGameId }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);
  const meta = MINI_GAMES[id];
  const Game = GAME_COMPONENTS[id];
  // a menu (the console home) opens straight away: no intro card or countdown
  const [phase, setPhase] = useState<Phase>(meta.menu ? "play" : "intro");
  const [round, setRound] = useState(meta.menu ? 1 : 0);
  const [count, setCount] = useState(3);
  const [paused, setPaused] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [mode, setMode] = useState<"solo" | "local" | "online">(() => (worldStore.get().pendingRoom ? "online" : "solo"));
  const [canOnline, setCanOnline] = useState(false);
  const [link, setLink] = useState<RoomLink | null>(null);
  const [joinCode] = useState(() => worldStore.get().pendingRoom?.code);
  const players: 1 | 2 = mode === "solo" ? 1 : 2;
  const setPlayers = (p: 1 | 2) => setMode(p === 1 ? "solo" : "local");
  const [hud, setHud] = useState<HudItem[]>([]);
  const [result, setResult] = useState<{ r: MiniGameResult; fresh: Achievement[]; record: boolean } | null>(null);
  // points on the site account for this round (null: not logged in / no site)
  const [points, setPoints] = useState<RoundReward | null>(null);
  const playStart = useRef(0);
  const [best] = useState(() => bestScore(id));
  const [touch] = useState(() => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);
  const primary = useRef<HTMLButtonElement>(null);

  const exit = useCallback(() => worldStore.set({ miniGame: null }), []);
  const character = useWorld((s) => s.character);
  const reducedMotion = useWorld((s) => s.reducedMotion);
  // the rival walks in once, before the first round against the computer
  const metRival = useRef(false);

  // is the player logged in on the site (points for rounds)?
  useEffect(() => {
    const r = rewardsStore.get();
    if (!r.available && !r.loading) void loadRewards();
  }, []);
  useEffect(() => {
    if (phase === "play") playStart.current = performance.now();
  }, [phase]);

  // online play: is the room server there? (not in the stand-alone preview)
  useEffect(() => {
    if (!meta.twoPlayer) return;
    let live = true;
    void onlineAvailable().then((ok) => live && setCanOnline(ok));
    if (worldStore.get().pendingRoom) worldStore.set({ pendingRoom: null });
    return () => {
      live = false;
    };
  }, [meta.twoPlayer]);
  useEffect(() => () => link?.close(), [link]);

  const begin = useCallback(() => {
    setResult(null);
    setPaused(false);
    setHud([]);
    setRound((n) => n + 1);
    setCount(3);
    setPhase("countdown");
  }, []);
  const start = useCallback(() => {
    audio.unlock();
    if (meta.opponent && mode === "solo" && !metRival.current) {
      metRival.current = true;
      setPhase("opponent");
      return;
    }
    begin();
  }, [begin, meta.opponent, mode]);

  // the friend's phone starts / restarts together with the host
  useEffect(() => {
    if (!link) return;
    return link.on((m) => {
      if (m.t === "start" && link.state.get().seat === 1) start();
    });
  }, [link, start]);
  const restart = () => {
    if (link) {
      if (link.state.get().seat !== 0) return;
      link.send({ t: "start" });
    }
    start();
  };

  // 3-2-1 before each round
  useEffect(() => {
    if (phase !== "countdown") return;
    audio.countdown(count === 0);
    if (count === 0) {
      const t = window.setTimeout(() => setPhase("play"), 500);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setCount((c) => c - 1), 700);
    return () => window.clearTimeout(t);
  }, [phase, count]);

  // Esc pauses / resumes (or leaves from the intro and result cards); hidden tab pauses
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (phase === "play" && !meta.menu) setPaused((p) => !p);
      else exit();
    };
    const onVis = () => document.hidden && phase === "play" && setPaused(true);
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [phase, exit, meta.menu]);
  const home = () => worldStore.set({ miniGame: "gc-console" });

  useEffect(() => {
    if (phase === "intro" || phase === "result" || paused) primary.current?.focus();
  }, [phase, paused]);

  const onEnd = useCallback(
    (r: MiniGameResult) => {
      const record = !r.twoPlayer && r.score > 0 && r.score > bestScore(id);
      const fresh = r.twoPlayer ? [] : recordRound(id, r.stats);
      audio.result(r.won ?? true);
      setResult({ r, fresh, record });
      setPoints(null);
      setPhase("result");
      if (!r.twoPlayer && !meta.menu) {
        const seconds = (performance.now() - playStart.current) / 1000;
        void reportRound(id, r.stats, seconds).then((p) => {
          if (!p) return;
          setPoints(p);
          // achievements new on the account (e.g. earned on this phone before logging in) are shown too
          const extra = ACHIEVEMENTS.filter((a) => p.achievements.some((x) => x.id === a.id));
          if (extra.length) setResult((cur) => (cur && cur.r === r ? { ...cur, fresh: [...cur.fresh, ...extra.filter((a) => !cur.fresh.includes(a))] } : cur));
        });
      }
    },
    [id, meta.menu],
  );

  const playing = phase === "play" || phase === "countdown";
  const two = players === 2 && !!meta.twoPlayer;
  const online = mode === "online" && !!link;
  const guest = online && link!.state.get().seat === 1;
  // online: each player has their own phone, so the normal controls apply
  const howToSet = two && mode !== "online" ? meta.twoPlayer!.howTo : meta.howTo;
  const howTo = touch ? howToSet.touch : howToSet.desktop;

  return (
    <div className={styles.layer} ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="aw-mg-title">
      <header className={styles.bar}>
        <h2 id="aw-mg-title" className={styles.title}>
          <span aria-hidden>{meta.emoji}</span> {meta.title}
        </h2>
        <div className={styles.hud} aria-live="off">
          {hud.map((h) => (
            <span key={h.label} className={`${styles.chip} ${h.warn ? styles.chipWarn : ""}`}>
              <span className={styles.chipLabel}>{h.label}</span>
              <strong>{h.value}</strong>
            </span>
          ))}
        </div>
        <div className={styles.barActions}>
          {meta.console && (
            <button type="button" className={`${ui.btn} ${ui.iconBtn}`} aria-label="صفحهٔ اصلی کنسول" title="صفحهٔ اصلی کنسول" onClick={home}>
              🏠
            </button>
          )}
          {phase === "play" && !meta.menu && (
            <button type="button" className={`${ui.btn} ${ui.iconBtn}`} aria-label={paused ? "ادامه" : "توقف"} onClick={() => setPaused((p) => !p)}>
              {paused ? "▶" : "⏸"}
            </button>
          )}
          <button type="button" className={`${ui.btn} ${ui.iconBtn}`} aria-label="خروج از مینی‌گیم" onClick={exit}>
            ✕
          </button>
        </div>
      </header>

      <div className={styles.stage}>
        {round > 0 && (
          <Suspense fallback={<div className={styles.center}>در حال آماده‌سازی…</div>}>
            <Game key={round} paused={(paused && !online) || phase !== "play"} difficulty={difficulty} players={two ? 2 : 1} online={online ? link : null} onHud={setHud} onEnd={onEnd} />
          </Suspense>
        )}

        {phase === "opponent" && <OpponentIntro me={character} reduced={reducedMotion} onDone={begin} />}

        {phase === "countdown" && (
          <div className={styles.countdown} aria-live="assertive">
            {count > 0 ? fa(count) : "شروع!"}
          </div>
        )}

        {phase === "intro" && (
          <div className={styles.cardWrap}>
            <section className={styles.card}>
              {meta.twoPlayer && (
                <fieldset className={styles.levels}>
                  <legend>حالت بازی</legend>
                  <button type="button" className={ui.btn} aria-pressed={!two} onClick={() => setPlayers(1)}>
                    {meta.twoPlayer.solo}
                  </button>
                  <button type="button" className={ui.btn} aria-pressed={mode === "local"} onClick={() => setPlayers(2)}>
                    👥 دونفره روی یک گوشی
                  </button>
                  {canOnline && (
                    <button type="button" className={ui.btn} aria-pressed={mode === "online"} onClick={() => setMode("online")}>
                      🌐 آنلاین با دوست
                    </button>
                  )}
                </fieldset>
              )}
              <p>{mode === "online" ? "هر کدام روی گوشی خودتان: یکی اتاق می‌سازد و کد ۵ رقمی را برای دیگری می‌فرستد. هر دو باید به اینترنت وصل باشید." : two ? meta.twoPlayer!.intro : meta.intro}</p>
              <h3 className={styles.cardHead}>راهنما</h3>
              <ul className={styles.howTo}>
                {howTo.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              {meta.difficulty && !two && (
                <fieldset className={styles.levels}>
                  <legend>سطح حریف</legend>
                  {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => (
                    <button key={d} type="button" className={ui.btn} aria-pressed={difficulty === d} onClick={() => setDifficulty(d)}>
                      {DIFFICULTY_LABEL[d]}
                    </button>
                  ))}
                </fieldset>
              )}
              {best > 0 && <p className={styles.best}>بهترین امتیاز این دستگاه: {fa(best)}</p>}
              {meta.note && (!two || id !== "foot-pool") && <p className={styles.note}>{meta.note}</p>}
              {mode === "online" && <Lobby game={id as OnlineGame} link={link} setLink={setLink} onStart={start} joinCode={joinCode} />}
              <div className={styles.cardActions}>
                {mode !== "online" && (
                  <button ref={primary} type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={start}>
                    شروع بازی
                  </button>
                )}
                <button type="button" className={ui.btn} onClick={exit}>
                  بازگشت به دنیای اتم
                </button>
              </div>
            </section>
          </div>
        )}

        {paused && playing && (
          <div className={styles.cardWrap}>
            <section className={styles.card}>
              <h3 className={styles.cardHead}>بازی متوقف شد</h3>
              {online && <p className={styles.note}>بازی آنلاین روی گوشی دوستتان ادامه دارد.</p>}
              <div className={styles.cardActions}>
                <button ref={primary} type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={() => setPaused(false)}>
                  ادامهٔ بازی
                </button>
                {!guest && (
                  <button type="button" className={ui.btn} onClick={restart}>
                    شروع دوباره
                  </button>
                )}
                <button type="button" className={ui.btn} onClick={exit}>
                  خروج
                </button>
              </div>
            </section>
          </div>
        )}

        {phase === "result" && result && (
          <div className={styles.cardWrap}>
            <section className={styles.card} aria-live="polite">
              <h3 className={`${styles.resultHead} ${result.r.won === false ? styles.lost : ""}`}>{result.r.headline}</h3>
              <ul className={styles.howTo}>
                {result.r.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              {!result.r.twoPlayer && (
                <>
                  <p className={styles.best}>
                    امتیاز: {fa(Math.round(result.r.score))}
                    {result.record ? " — 🏆 رکورد جدید این دستگاه" : ""}
                  </p>
                  {points && (
                    <p className={styles.pointsLine} role="status">
                      ⭐ {points.roundPoints > 0 ? `+${fa(points.roundPoints)} امتیاز برای این دور` : "سقف امتیاز دورهای امروز پر شده"}
                      {points.achievements.length > 0 && ` · +${fa(points.achievements.reduce((t, a) => t + a.points, 0))} برای دستاورد`} — امتیاز شما: {fa(points.balance)}
                    </p>
                  )}
                  <NewAchievements list={result.fresh} />
                  <SubmitScore game={id} result={result.r} />
                </>
              )}
              {guest && <p className={styles.note}>میزبان می‌تواند بازی را دوباره شروع کند.</p>}
              <div className={styles.cardActions}>
                {!guest && (
                  <button ref={primary} type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={restart}>
                    دوباره
                  </button>
                )}
                {meta.console && (
                  <button type="button" className={ui.btn} onClick={home}>
                    🏠 بازی دیگر
                  </button>
                )}
                <button type="button" className={ui.btn} onClick={exit}>
                  بازگشت به دنیای اتم
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
