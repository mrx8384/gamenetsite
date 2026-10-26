import type { MiniGameId } from "../data/machineData";

export type Stats = Record<string, number | boolean>;

export interface Achievement {
  id: string;
  emoji: string;
  title: string;
  hint: string;
  game: MiniGameId | null;
  test: (game: MiniGameId, s: Stats, played: Set<MiniGameId>) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "hockey-first-win", emoji: "🏒", title: "اولین برد ایرهاکی", hint: "یک دست ایرهاکی را ببرید.", game: "air-hockey", test: (g, s) => g === "air-hockey" && s.won === true },
  { id: "hockey-hard-win", emoji: "🔥", title: "قهرمان سطح سخت", hint: "ایرهاکی را در سطح سخت ببرید.", game: "air-hockey", test: (g, s) => g === "air-hockey" && s.won === true && s.hard === true },
  { id: "hockey-clean", emoji: "🧱", title: "دروازهٔ بسته", hint: "ایرهاکی را بدون گل خوردن ببرید.", game: "air-hockey", test: (g, s) => g === "air-hockey" && s.won === true && s.against === 0 },
  { id: "dig-first-truck", emoji: "🚚", title: "اولین کامیون پر", hint: "در بیل مکانیکی یک کامیون را پر کنید.", game: "construction-excavator", test: (g, s) => g === "construction-excavator" && Number(s.trucks) >= 1 },
  { id: "dig-three-trucks", emoji: "🏗️", title: "رانندهٔ حرفه‌ای", hint: "در یک دور بیل مکانیکی ۳ کامیون پر کنید.", game: "construction-excavator", test: (g, s) => g === "construction-excavator" && Number(s.trucks) >= 3 },
  { id: "pool-clear", emoji: "⚽", title: "میز پاک", hint: "همهٔ توپ‌های فوت‌پول را داخل جیب بیندازید.", game: "foot-pool", test: (g, s) => g === "foot-pool" && s.cleared === true },
  { id: "pool-efficient", emoji: "🎯", title: "ضربه‌های دقیق", hint: "میز فوت‌پول را با ۱۵ ضربه یا کمتر پاک کنید.", game: "foot-pool", test: (g, s) => g === "foot-pool" && s.cleared === true && Number(s.kicks) <= 15 },
  { id: "pool-no-scratch", emoji: "🤍", title: "توپ سفید سالم", hint: "میز فوت‌پول را بدون افتادن توپ سفید پاک کنید.", game: "foot-pool", test: (g, s) => g === "foot-pool" && s.cleared === true && s.scratches === 0 },
  { id: "pad-combo", emoji: "🎮", title: "استاد دسته", hint: "در چالش دستهٔ گیم‌نت ۲۰ ضربهٔ پیاپی درست بزنید.", game: "gc-controller", test: (g, s) => g === "gc-controller" && Number(s.bestCombo) >= 20 },
  { id: "pad-fast", emoji: "⚡", title: "انگشت برق‌آسا", hint: "در چالش دستهٔ گیم‌نت ۵۰۰ امتیاز بگیرید.", game: "gc-controller", test: (g, s) => g === "gc-controller" && Number(s.score) >= 500 },
  { id: "city-taxi", emoji: "🚕", title: "رانندهٔ تاکسی اتم", hint: "در شهر اتم ۵ مسافر را در یک دور برسانید.", game: "gc-city", test: (g, s) => g === "gc-city" && Number(s.deliveries) >= 5 },
  { id: "city-safe", emoji: "🛡️", title: "رانندهٔ بی‌نقص", hint: "در شهر اتم ۳ مسافر را بدون هیچ تصادفی برسانید.", game: "gc-city", test: (g, s) => g === "gc-city" && Number(s.deliveries) >= 3 && s.crashes === 0 },
  { id: "ball-win", emoji: "🏆", title: "قهرمان زمین اتم", hint: "در فوتبال اتم یک بازی را ببرید.", game: "gc-football", test: (g, s) => g === "gc-football" && s.won === true },
  { id: "ball-hat", emoji: "🎩", title: "هت‌تریک", hint: "در فوتبال اتم در یک بازی ۳ گل بزنید.", game: "gc-football", test: (g, s) => g === "gc-football" && Number(s.goalsFor) >= 3 },
  { id: "explorer", emoji: "🧭", title: "گشت کامل اتم", hint: "دست‌کم سه مینی‌گیم مختلف را بازی کنید.", game: null, test: (_g, _s, played) => played.size >= 3 },
];
