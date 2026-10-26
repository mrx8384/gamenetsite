"use client";

import { useEffect, useRef, useState } from "react";
import { audio } from "../../systems/AudioManager";
import styles from "../minigames.module.css";
import { fa, formatTime, type MiniGameProps } from "../types";
import { exposeForTests, useCanvasLoop, useHudThrottle } from "../useCanvas";
import { aimGuide, BALLS, createPool, cueBall, FIELD, kick, POCKETS, type PoolEvent, type PoolState, stepPool } from "./engine";

/** Ball colours (pool-style numbers on footballs; the club's real ball set is not documented). */
const COLORS = ["#ffffff", "#f6c21a", "#2f6fe0", "#e23b3b", "#7b3fc4", "#f07a12", "#1f9e5a", "#8b2b2b", "#222222"];
const MAX_DRAG = 150; // px for a full-power kick

/** Drag in progress, in table space: where it started and where the pointer is now. */
interface Aim {
  sx: number;
  sy: number;
  px: number;
  py: number;
}

/** Pull-back vector → kick direction and power (drag length on screen). */
function dragKick(a: Aim, m: DOMMatrix) {
  const dx = a.sx - a.px;
  const dy = a.sy - a.py;
  const scale = Math.sqrt(m.a ** 2 + m.b ** 2);
  return {
    dx,
    dy,
    power: Math.min(1, (Math.hypot(dx, dy) * scale) / MAX_DRAG),
  };
}

/**
 * Foot-pool on the upper floor's field: navy carpet, grey rails, six glowing orange pockets.
 * Pull back from the white ball (like a slingshot) and let go to kick; keys: ←/→ aim, hold Space.
 */
export default function FootPoolGame({ paused, players, online, onHud, onEnd }: MiniGameProps) {
  const sim = useRef<PoolState>(createPool(players));
  // online: whoever's turn it is kicks and simulates on their phone; the other phone follows (turn 0 = seat 0)
  const [net] = useState(() => online ?? null);
  const [seat] = useState<0 | 1>(() => online?.state.get().seat ?? 0);
  const peerName = net?.state.get().peerName ?? "دوست شما";
  const link = useRef({ kicking: false, lastSent: 0, aimSent: false, targets: null as [number, number, number][] | null, ghost: null as Ghost | null });
  const myTurn = () => !net || sim.current.turn === seat;
  const who = (turn: 0 | 1) => (net ? (turn === seat ? "شما" : peerName) : turn === 0 ? "بازیکن ۱ (سبز)" : "بازیکن ۲ (صورتی)");
  const hud = useHudThrottle(onHud);
  const aim = useRef<Aim | null>(null);
  const keyAim = useRef({ angle: 0, charging: false, power: 0 });
  const view = useRef(new DOMMatrix());
  const [msg, setMsg] = useState<string | null>(null);
  const ended = useRef(false);
  const pausedRef = useRef(paused);
  const keys = useRef(new Set<string>());
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => exposeForTests(sim.current), []);

  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(null), 1500);
    return () => window.clearTimeout(t);
  }, [msg]);

  const doKick = (dx: number, dy: number, power: number) => {
    if (!myTurn()) {
      setMsg(`نوبت ${peerName} است`);
      return;
    }
    const ev = kick(sim.current, dx, dy, power);
    if (!ev.length) return;
    audio.footKick(power);
    if (net) {
      link.current.kicking = true;
      net.send({ t: "kick", power });
    }
  };

  // online messages from the friend's phone
  useEffect(() => {
    if (!net) return;
    return net.on((m) => {
      const s = sim.current;
      const l = link.current;
      if (m.t === "kick") {
        audio.footKick(Number(m.power) || 0.5);
        l.ghost = null;
      } else if (m.t === "aim") l.ghost = typeof m.dx === "number" ? { dx: m.dx as number, dy: m.dy as number, power: Number(m.power) || 0 } : null;
      else if (m.t === "bs" && validBalls(m.b, s.balls.length)) l.targets = m.b;
      else if (m.t === "ev" && Array.isArray(m.e)) for (const e of m.e as PoolEvent[]) showEvent(e);
      else if (m.t === "end" && validEnd(m.st, s.balls.length)) {
        const st = m.st;
        st.b.forEach(([x, y, inP], i) => Object.assign(s.balls[i], { x, y, vx: 0, vy: 0, inPocket: inP === 1 }));
        Object.assign(s, { turn: st.turn, balls2: st.balls2, pocketed: st.pocketed, kicks: st.kicks, scratches: st.scratches, over: st.over, moving: false });
        l.targets = null;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- showEvent only touches refs / state setters
  }, [net]);

  function showEvent(e: PoolEvent) {
    const s = sim.current;
    if (e.type === "ballHit" && e.v > 0.3) audio.footBall(e.v);
    else if (e.type === "cushion" && e.v > 0.3) audio.hockeyWall(e.v);
    else if (e.type === "pocket") {
      audio.pocket();
      setMsg(`توپ ${fa(e.id)} داخل جیب! ⚽`);
    } else if (e.type === "scratch") {
      audio.goal(false);
      setMsg(s.players === 2 ? "توپ سفید افتاد!" : "توپ سفید افتاد: ۵۰ امتیاز جریمه");
    } else if (e.type === "turn") {
      audio.countdown(false);
      window.setTimeout(() => setMsg(net ? (e.player === seat ? "نوبت شماست" : `نوبت ${peerName}`) : `نوبت ${who(e.player)}`), 400);
    }
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === "INPUT") return;
      const k = e.key.toLowerCase();
      if (k === " ") {
        e.preventDefault();
        if (!e.repeat && !sim.current.moving && myTurn()) keyAim.current.charging = true;
        return;
      }
      if (k.startsWith("arrow")) e.preventDefault();
      keys.current.add(k);
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keys.current.delete(k);
      if (k === " " && keyAim.current.charging) {
        const ka = keyAim.current;
        ka.charging = false;
        if (!pausedRef.current) doKick(Math.cos(ka.angle), Math.sin(ka.angle), ka.power);
        ka.power = 0;
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doKick / myTurn read refs only
  }, []);

  const canvas = useCanvasLoop((ctx, w, h, dt) => {
    const s = sim.current;
    // long side along the longer screen side
    const portrait = h > w * 1.05;
    const long = FIELD.L + 0.9;
    const short = FIELD.W + 0.9;
    const scale = portrait ? Math.min(w / short, h / long) : Math.min(w / long, h / short);
    view.current = new DOMMatrix()
      .translate(w / 2, h / 2)
      .rotate(portrait ? -90 : 0)
      .scale(scale);

    if (!pausedRef.current && !ended.current) {
      const ka = keyAim.current;
      const k = keys.current;
      const turn = (k.has("arrowright") || k.has("d") ? 1 : 0) - (k.has("arrowleft") || k.has("a") ? 1 : 0);
      if (turn) ka.angle += turn * 1.6 * dt;
      if (ka.charging) ka.power = Math.min(1, ka.power + dt * 0.8);
      const events = stepPool(s, dt);
      for (const e of events) showEvent(e);
      if (net) syncOnline(s, events);
      if (s.over && !ended.current) {
        ended.current = true;
        const score = Math.max(0, Math.round(s.score));
        if (net) {
          const mine = s.balls2[seat];
          const theirs = s.balls2[seat === 0 ? 1 : 0];
          window.setTimeout(
            () =>
              onEnd({
                won: mine >= theirs,
                twoPlayer: true,
                score: 0,
                detail: "",
                stats: {},
                headline: mine === theirs ? "🤝 مساوی!" : mine > theirs ? "🏆 شما بردید!" : `${peerName} برد`,
                lines: [`توپ‌ها: شما ${fa(mine)} — ${peerName} ${fa(theirs)}`, "بازی آنلاین با دوست"],
              }),
            600,
          );
          return;
        }
        if (s.players === 2) {
          const [a, b] = s.balls2;
          window.setTimeout(
            () =>
              onEnd({
                won: true,
                twoPlayer: true,
                score: 0,
                detail: "",
                stats: {},
                headline: a === b ? "🤝 مساوی!" : `🏆 بازیکن ${a > b ? "۱ (سبز)" : "۲ (صورتی)"} برد!`,
                lines: [`توپ‌ها: بازیکن ۱ ${fa(a)} — بازیکن ۲ ${fa(b)}`, `ضربه‌ها: ${fa(s.kicks)}`, `زمان: ${formatTime(s.elapsed)}`],
              }),
            600,
          );
          return;
        }
        window.setTimeout(
          () =>
            onEnd({
              won: true,
              headline: "🏆 میز پاک شد!",
              lines: [`ضربه‌ها: ${fa(s.kicks)}`, `افتادن توپ سفید: ${fa(s.scratches)}`, `زمان: ${formatTime(s.elapsed)}`],
              score,
              detail: `${fa(s.kicks)} ضربه`,
              stats: {
                cleared: true,
                kicks: s.kicks,
                scratches: s.scratches,
                seconds: Math.round(s.elapsed),
                score,
              },
            }),
          600,
        );
      }
    }
    if (net)
      hud([
        { label: "نوبت", value: s.turn === seat ? "شما" : peerName, warn: s.turn !== seat },
        { label: "شما", value: `${fa(s.balls2[seat])} توپ` },
        { label: peerName, value: `${fa(s.balls2[seat === 0 ? 1 : 0])} توپ` },
        { label: "باقی‌مانده", value: fa(BALLS - s.pocketed) },
      ]);
    else if (s.players === 2)
      hud([
        {
          label: "نوبت",
          value: s.turn === 0 ? "بازیکن ۱ (سبز)" : "بازیکن ۲ (صورتی)",
          warn: s.turn === 1,
        },
        { label: "بازیکن ۱", value: `${fa(s.balls2[0])} توپ` },
        { label: "بازیکن ۲", value: `${fa(s.balls2[1])} توپ` },
        { label: "باقی‌مانده", value: fa(BALLS - s.pocketed) },
      ]);
    else
      hud([
        { label: "ضربه", value: fa(s.kicks) },
        { label: "باقی‌مانده", value: fa(BALLS - s.pocketed) },
        { label: "امتیاز", value: fa(Math.max(0, Math.round(s.score))) },
        { label: "زمان", value: formatTime(s.elapsed) },
      ]);
    draw(ctx, w, h, s, view.current, myTurn() ? aim.current : null, keyAim.current, net ? { mine: myTurn(), ghost: link.current.ghost, mySeat: seat } : null);
  });

  /** Online: stream my kick to the friend, or follow theirs. */
  function syncOnline(s: PoolState, events: PoolEvent[]) {
    const l = link.current;
    const now = performance.now();
    if (l.kicking) {
      const shown = events.filter((e) => e.type === "pocket" || e.type === "scratch" || e.type === "turn" || (e.type === "ballHit" && e.v > 1));
      if (shown.length) net!.send({ t: "ev", e: shown });
      if (now - l.lastSent > 66) {
        l.lastSent = now;
        net!.send({ t: "bs", b: s.balls.map((b) => [round(b.x), round(b.y), b.inPocket ? 1 : 0]) }, true);
      }
      if (!s.moving) {
        l.kicking = false;
        const st: EndState = { b: s.balls.map((b) => [b.x, b.y, b.inPocket ? 1 : 0]), turn: s.turn, balls2: s.balls2, pocketed: s.pocketed, kicks: s.kicks, scratches: s.scratches, over: s.over };
        net!.send({ t: "end", st });
      }
      return;
    }
    // my aim, so the friend can watch (10 times a second)
    if (myTurn() && !s.moving) {
      const a = aim.current;
      const ka = keyAim.current;
      const k = a ? dragKick(a, view.current) : null;
      const aiming = (k && k.power > 0.04) || ka.charging;
      if (aiming && now - l.lastSent > 100) {
        l.lastSent = now;
        l.aimSent = true;
        const d = k && k.power > 0.04 ? { dx: k.dx, dy: k.dy, power: k.power } : { dx: Math.cos(ka.angle), dy: Math.sin(ka.angle), power: ka.power };
        net!.send({ t: "aim", ...d }, true);
      } else if (!aiming && l.aimSent) {
        l.aimSent = false;
        net!.send({ t: "aim" }, true);
      }
    }
    // the friend's kick: glide the balls to the positions they send
    if (l.targets) {
      const f = 1 - Math.exp(-(1 / 60) * 18);
      l.targets.forEach(([x, y, inP], i) => {
        const b = s.balls[i];
        b.inPocket = inP === 1;
        b.x += (x - b.x) * f;
        b.y += (y - b.y) * f;
      });
    }
  }

  const toTable = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const p = view.current.inverse().transformPoint(new DOMPoint(e.clientX - r.left, e.clientY - r.top));
    return { x: p.x, y: p.y };
  };

  return (
    <div className={styles.canvasBox}>
      <canvas
        ref={canvas}
        className={styles.canvas}
        role="img"
        aria-label="زمین فوت‌پول. از توپ سفید به عقب بکشید و رها کنید تا ضربه بزنید."
        onPointerDown={(e) => {
          if (sim.current.moving || pausedRef.current) return;
          if (!myTurn()) {
            setMsg(`نوبت ${peerName} است`);
            return;
          }
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* pointer already gone */
          }
          const p = toTable(e);
          aim.current = { sx: p.x, sy: p.y, px: p.x, py: p.y };
        }}
        onPointerMove={(e) => {
          if (!aim.current) return;
          const p = toTable(e);
          aim.current = { ...aim.current, px: p.x, py: p.y };
        }}
        onPointerUp={(e) => {
          const a = aim.current;
          if (!a) return;
          const p = toTable(e);
          const k = dragKick({ ...a, px: p.x, py: p.y }, view.current);
          aim.current = null;
          // a tap (tiny drag) does not kick
          if (!pausedRef.current && k.power > 0.04) {
            keyAim.current.angle = Math.atan2(k.dy, k.dx);
            doKick(k.dx, k.dy, k.power);
          }
        }}
        onPointerCancel={() => {
          aim.current = null;
        }}
      />
      {msg && (
        <div className={styles.flash} role="status">
          {msg}
        </div>
      )}
    </div>
  );
}

interface Ghost {
  dx: number;
  dy: number;
  power: number;
}

/** Final positions after an online kick: [x, y, inPocket] per ball + turn bookkeeping. */
interface EndState {
  b: [number, number, number][];
  turn: 0 | 1;
  balls2: [number, number];
  pocketed: number;
  kicks: number;
  scratches: number;
  over: boolean;
}

const round = (v: number) => Math.round(v * 1000) / 1000;

const num = (v: unknown) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 100;
const nat = (v: unknown, max: number) => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max;

/** Ball list from the friend's phone: [x, y, inPocket] for every ball, finite numbers only. */
export function validBalls(b: unknown, count: number): b is [number, number, number][] {
  return Array.isArray(b) && b.length === count && b.every((r) => Array.isArray(r) && r.length === 3 && num(r[0]) && num(r[1]) && (r[2] === 0 || r[2] === 1));
}

export function validEnd(st: unknown, count: number): st is EndState {
  if (!st || typeof st !== "object") return false;
  const o = st as Record<string, unknown>;
  return (
    validBalls(o.b, count) &&
    (o.turn === 0 || o.turn === 1) &&
    Array.isArray(o.balls2) &&
    o.balls2.length === 2 &&
    o.balls2.every((n) => nat(n, BALLS)) &&
    nat(o.pocketed, BALLS) &&
    nat(o.kicks, 10000) &&
    nat(o.scratches, 10000) &&
    typeof o.over === "boolean"
  );
}

function draw(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: PoolState,
  m: DOMMatrix,
  aim: Aim | null,
  ka: { angle: number; charging: boolean; power: number },
  net: { mine: boolean; ghost: Ghost | null; mySeat: 0 | 1 } | null = null,
) {
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
  const L = FIELD.L;
  const W = FIELD.W;
  const rail = 0.36;
  // white outer sides + grey rail tops
  ctx.fillStyle = "#e9ecee";
  ctx.fillRect(-L / 2 - rail - 0.06, -W / 2 - rail - 0.06, L + 2 * rail + 0.12, W + 2 * rail + 0.12);
  ctx.fillStyle = "#6f767b";
  ctx.fillRect(-L / 2 - rail, -W / 2 - rail, L + 2 * rail, W + 2 * rail);
  // navy carpet
  ctx.fillStyle = "#16213d";
  ctx.fillRect(-L / 2, -W / 2, L, W);
  ctx.fillStyle = "rgba(255,255,255,0.025)";
  for (let i = 0; i < 260; i++) {
    const x = ((i * 97) % 480) / 100 - L / 2;
    const y = ((i * 61) % 330) / 100 - W / 2;
    ctx.fillRect(x, y, 0.03, 0.03);
  }
  // pockets: orange glow cut-outs in the rails
  for (const p of POCKETS) {
    ctx.save();
    ctx.shadowColor = "#ff9d1a";
    ctx.shadowBlur = 24;
    ctx.fillStyle = "#ffb43a";
    ctx.beginPath();
    ctx.arc(p.x, p.y, FIELD.pocketR + 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#2a1a05";
    ctx.beginPath();
    ctx.arc(p.x, p.y, FIELD.pocketR, 0, Math.PI * 2);
    ctx.fill();
  }
  // ATOM logo spot on the rail (like the photo)
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = "#c9b98a";
  ctx.lineWidth = 0.015;
  ctx.beginPath();
  ctx.arc(-L / 2 - rail / 2, -W / 4, 0.12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  const c = cueBall(s);
  // aiming: drag line + guide to the first contact
  if (!s.moving && !s.over && (!net || net.mine || net.ghost)) {
    let dir: { x: number; y: number } | null = {
      x: Math.cos(ka.angle),
      y: Math.sin(ka.angle),
    };
    let power = 0;
    if (net && !net.mine && net.ghost) {
      // the friend is aiming
      dir = { x: net.ghost.dx, y: net.ghost.dy };
      power = net.ghost.power;
    }
    if (aim) {
      const k = dragKick(aim, m);
      if (k.power > 0.04) {
        dir = { x: k.dx, y: k.dy };
        power = k.power;
      }
    }
    if (ka.charging && (!net || net.mine)) {
      dir = { x: Math.cos(ka.angle), y: Math.sin(ka.angle) };
      power = ka.power;
    }
    if (dir && Math.hypot(dir.x, dir.y) > 1e-3) {
      const g = aimGuide(s, dir.x, dir.y);
      ctx.setLineDash([0.08, 0.06]);
      ctx.lineWidth = 0.025;
      // the aiming line takes the colour of whoever kicks (two players: green / pink)
      ctx.strokeStyle = (net ? !net.mine : s.players === 2 && s.turn === 1) ? "rgba(255,79,160,0.9)" : "rgba(57,255,136,0.85)";
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(g.x, g.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(g.x, g.y, FIELD.ballR, 0, Math.PI * 2);
      ctx.stroke();
      if (power > 0) {
        // power arc around the white ball (green → pink)
        ctx.lineWidth = 0.05;
        ctx.strokeStyle = power > 0.75 ? "#ff4fa0" : "#39ff88";
        ctx.beginPath();
        ctx.arc(c.x, c.y, FIELD.ballR + 0.09, -Math.PI / 2, -Math.PI / 2 + power * Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  // balls
  for (const b of s.balls) {
    if (b.inPocket) continue;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.arc(b.x + 0.025, b.y + 0.03, FIELD.ballR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS[b.id];
    ctx.beginPath();
    ctx.arc(b.x, b.y, FIELD.ballR, 0, Math.PI * 2);
    ctx.fill();
    // football panels
    ctx.fillStyle = b.id === 0 ? "#222" : "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(b.x, b.y, FIELD.ballR * 0.38, 0, Math.PI * 2);
    ctx.fill();
    if (b.id > 0) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(-Math.atan2(m.b, m.a)); // numbers upright on screen
      ctx.scale(0.01, 0.01);
      ctx.fillStyle = "#111";
      ctx.font = "bold 7px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(b.id), 0, 0.5);
      ctx.restore();
    } else {
      ctx.fillStyle = "#222";
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(b.x + Math.cos(a) * FIELD.ballR * 0.78, b.y + Math.sin(a) * FIELD.ballR * 0.78, FIELD.ballR * 0.16, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}
