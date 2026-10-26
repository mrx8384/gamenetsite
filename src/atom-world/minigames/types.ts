import type { MiniGameId } from "../data/machines";
import type { Stats } from "./achievements";
import type { RoomLink } from "../online/connection";

export type Difficulty = "easy" | "normal" | "hard";

export interface HudItem {
  label: string;
  value: string;
  /** Highlight (e.g. the last seconds). */
  warn?: boolean;
}

export interface MiniGameResult {
  won?: boolean;
  headline: string;
  lines: string[];
  /** Points for the score table (higher is better). */
  score: number;
  /** Short summary saved with the score, e.g. «۵ – ۲ (سخت)». */
  detail: string;
  /** Numbers / flags the achievements are checked against (and sent to the site with the score). */
  stats: Stats;
  /** Two players on one device: no score table or achievements (the points are not one person's). */
  twoPlayer?: boolean;
}

export interface MiniGameProps {
  paused: boolean;
  difficulty: Difficulty;
  /** 2 = two players (this device, or online when `online` is set) */
  players: 1 | 2;
  /** Playing with a friend on another phone. */
  online?: RoomLink | null;
  onHud: (items: HudItem[]) => void;
  onEnd: (r: MiniGameResult) => void;
}

export interface MiniGameMeta {
  id: MiniGameId;
  title: string;
  emoji: string;
  intro: string;
  howTo: { touch: string[]; desktop: string[] };
  difficulty: boolean;
  /** Two players on one device: labels and how-to for that mode. */
  twoPlayer?: { solo: string; intro: string; howTo: { touch: string[]; desktop: string[] } };
  /** Toy / temporary-model note shown on the intro card. */
  note?: string;
  /** A menu (the console home screen): no intro card, countdown, pause or result. */
  menu?: boolean;
  /** Runs on a gaming-center console: «🏠» goes back to the console home screen. */
  console?: boolean;
}

export const fa = (n: number, digits = 0) => n.toLocaleString("fa-IR", { maximumFractionDigits: digits, minimumFractionDigits: digits });

export function formatTime(sec: number) {
  const s = Math.max(0, Math.ceil(sec));
  return `${fa(Math.floor(s / 60))}:${fa(s % 60).padStart(2, "۰")}`;
}
