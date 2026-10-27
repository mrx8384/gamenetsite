import type { MiniGameId } from "../data/machineData";

export type Stats = Record<string, number | boolean>;

export interface Achievement {
  id: string;
  emoji: string;
  title: string;
  hint: string;
  game: MiniGameId | null;
  /**
   * Points for the club's reward cards (once per account). This is the default: the manager can
   * change it in the site's admin panel (Admin → دستاوردها و جوایز).
   */
  points: number;
  /** Hidden until earned: the list only shows «دستاورد مخفی». */
  hidden?: boolean;
  test: (game: MiniGameId, s: Stats, played: Set<MiniGameId>) => boolean;
}

/** Mini-games that count for «همهٔ بازی‌ها» (the console home screen is a menu, not a game). */
export const PLAYABLE_GAMES: MiniGameId[] = ["air-hockey", "construction-excavator", "foot-pool", "gc-controller", "gc-city", "gc-football"];

const n = (v: number | boolean | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/**
 * Pure (no DOM): the site's server checks the same tests against the stats a round reports, so a
 * browser cannot simply claim an achievement. Ids never change (they are stored on accounts).
 */
export const ACHIEVEMENTS: Achievement[] = [
  // ── air hockey
  { id: "hockey-first-win", emoji: "🏒", title: "اولین برد ایرهاکی", hint: "یک دست ایرهاکی را ببرید.", game: "air-hockey", points: 50, test: (g, s) => g === "air-hockey" && s.won === true },
  { id: "hockey-hard-win", emoji: "🔥", title: "قهرمان سطح سخت", hint: "ایرهاکی را در سطح سخت ببرید.", game: "air-hockey", points: 100, test: (g, s) => g === "air-hockey" && s.won === true && s.hard === true },
  { id: "hockey-clean", emoji: "🧱", title: "دروازهٔ بسته", hint: "ایرهاکی را بدون گل خوردن ببرید.", game: "air-hockey", points: 100, test: (g, s) => g === "air-hockey" && s.won === true && n(s.against) === 0 },
  { id: "hockey-lightning", emoji: "🌩️", title: "رعد ایرهاکی", hint: "یک برد خیلی سریع در سطح سخت.", game: "air-hockey", points: 250, hidden: true, test: (g, s) => g === "air-hockey" && s.won === true && s.hard === true && n(s.seconds) > 0 && n(s.seconds) <= 90 },
  // ── excavator
  { id: "dig-first-truck", emoji: "🚚", title: "اولین کامیون پر", hint: "در بیل مکانیکی یک کامیون را پر کنید.", game: "construction-excavator", points: 50, test: (g, s) => g === "construction-excavator" && n(s.trucks) >= 1 },
  { id: "dig-three-trucks", emoji: "🏗️", title: "رانندهٔ حرفه‌ای", hint: "در یک دور بیل مکانیکی ۳ کامیون پر کنید.", game: "construction-excavator", points: 100, test: (g, s) => g === "construction-excavator" && n(s.trucks) >= 3 },
  { id: "dig-five-trucks", emoji: "⛰️", title: "سلطان خاک", hint: "در یک دور بیل مکانیکی ۵ کامیون پر کنید.", game: "construction-excavator", points: 150, test: (g, s) => g === "construction-excavator" && n(s.trucks) >= 5 },
  { id: "dig-legend", emoji: "🦾", title: "بازوی فولادی", hint: "یک رکورد بزرگ در بیل مکانیکی.", game: "construction-excavator", points: 250, hidden: true, test: (g, s) => g === "construction-excavator" && n(s.trucks) >= 7 },
  // ── foot-pool
  { id: "pool-clear", emoji: "⚽", title: "میز پاک", hint: "همهٔ توپ‌های فوت‌پول را داخل جیب بیندازید.", game: "foot-pool", points: 50, test: (g, s) => g === "foot-pool" && s.cleared === true },
  { id: "pool-efficient", emoji: "🎯", title: "ضربه‌های دقیق", hint: "میز فوت‌پول را با ۱۵ ضربه یا کمتر پاک کنید.", game: "foot-pool", points: 100, test: (g, s) => g === "foot-pool" && s.cleared === true && n(s.kicks) > 0 && n(s.kicks) <= 15 },
  { id: "pool-no-scratch", emoji: "🤍", title: "توپ سفید سالم", hint: "میز فوت‌پول را بدون افتادن توپ سفید پاک کنید.", game: "foot-pool", points: 100, test: (g, s) => g === "foot-pool" && s.cleared === true && n(s.scratches) === 0 },
  { id: "pool-masterpiece", emoji: "💎", title: "شاهکار فوت‌پول", hint: "یک میز بی‌نقص و خیلی کوتاه.", game: "foot-pool", points: 250, hidden: true, test: (g, s) => g === "foot-pool" && s.cleared === true && n(s.kicks) > 0 && n(s.kicks) <= 10 && n(s.scratches) === 0 },
  // ── controller challenge
  { id: "pad-first", emoji: "🕹️", title: "دست‌گرمی", hint: "در چالش دستهٔ گیم‌نت ۱۰ ضربهٔ درست بزنید.", game: "gc-controller", points: 50, test: (g, s) => g === "gc-controller" && n(s.hits) >= 10 },
  { id: "pad-combo", emoji: "🎮", title: "استاد دسته", hint: "در چالش دستهٔ گیم‌نت ۲۰ ضربهٔ پیاپی درست بزنید.", game: "gc-controller", points: 100, test: (g, s) => g === "gc-controller" && n(s.bestCombo) >= 20 },
  { id: "pad-fast", emoji: "⚡", title: "انگشت برق‌آسا", hint: "در چالش دستهٔ گیم‌نت ۵۰۰ امتیاز بگیرید.", game: "gc-controller", points: 100, test: (g, s) => g === "gc-controller" && n(s.score) >= 500 },
  { id: "pad-machine", emoji: "🤖", title: "دست‌های ماشینی", hint: "یک رشتهٔ بلند در سخت‌ترین حالت.", game: "gc-controller", points: 250, hidden: true, test: (g, s) => g === "gc-controller" && s.hard === true && n(s.bestCombo) >= 30 },
  // ── Atom City
  { id: "city-first", emoji: "🧍", title: "اولین مسافر", hint: "در شهر اتم یک مسافر را به مقصد برسانید.", game: "gc-city", points: 50, test: (g, s) => g === "gc-city" && n(s.deliveries) >= 1 },
  { id: "city-taxi", emoji: "🚕", title: "رانندهٔ تاکسی اتم", hint: "در شهر اتم ۵ مسافر را در یک دور برسانید.", game: "gc-city", points: 100, test: (g, s) => g === "gc-city" && n(s.deliveries) >= 5 },
  { id: "city-safe", emoji: "🛡️", title: "رانندهٔ بی‌نقص", hint: "در شهر اتم ۳ مسافر را بدون هیچ تصادفی برسانید.", game: "gc-city", points: 100, test: (g, s) => g === "gc-city" && n(s.deliveries) >= 3 && n(s.crashes) === 0 },
  { id: "city-tycoon", emoji: "💰", title: "سلطان شهر", hint: "یک دور پرسود در شهر اتم.", game: "gc-city", points: 250, hidden: true, test: (g, s) => g === "gc-city" && n(s.money) >= 600 },
  // ── Atom football
  { id: "ball-first-goal", emoji: "🥅", title: "اولین گل", hint: "در فوتبال اتم یک گل بزنید.", game: "gc-football", points: 50, test: (g, s) => g === "gc-football" && n(s.goalsFor) >= 1 },
  { id: "ball-win", emoji: "🏆", title: "قهرمان زمین اتم", hint: "در فوتبال اتم یک بازی را ببرید.", game: "gc-football", points: 100, test: (g, s) => g === "gc-football" && s.won === true },
  { id: "ball-hat", emoji: "🎩", title: "هت‌تریک", hint: "در فوتبال اتم در یک بازی ۳ گل بزنید.", game: "gc-football", points: 150, test: (g, s) => g === "gc-football" && n(s.goalsFor) >= 3 },
  { id: "ball-wall", emoji: "🧤", title: "دیوار آهنین", hint: "یک برد ویژه در سخت‌ترین حالت.", game: "gc-football", points: 250, hidden: true, test: (g, s) => g === "gc-football" && s.won === true && s.hard === true && n(s.goalsAgainst) === 0 },
  // ── the whole world
  { id: "explorer", emoji: "🧭", title: "گشت کامل اتم", hint: "دست‌کم سه مینی‌گیم مختلف را بازی کنید.", game: null, points: 100, test: (_g, _s, played) => played.size >= 3 },
  { id: "explorer-all", emoji: "🌍", title: "جهانگرد اتم", hint: "همهٔ بازی‌های دنیای اتم را امتحان کنید.", game: null, points: 200, hidden: true, test: (_g, _s, played) => PLAYABLE_GAMES.every((g) => played.has(g)) },
];
