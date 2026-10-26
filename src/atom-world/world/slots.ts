/**
 * Wall art and sign texts the club's manager can change in the admin editor (docs/ADMIN_WORLD.md).
 *
 * Art: every built-in wall painting / printed panel is a slot keyed by its id; its default is the
 * texture rectified from the photos. A replacement image (uploaded in the editor) is used wherever
 * the default would be — the scenes load textures through `resolveArt`, so they need no change.
 * Texts: lettering drawn in the world (signs, chalkboard) and the place names in the HUD / menu.
 */
const T = "/atom-world/textures";
const GC = "/atom-world/envs/gaming-center";

export interface ArtSlot {
  id: string;
  label: string;
  /** Group in the editor. */
  place: string;
  default: string;
  /** Width / height of the default image, so a replacement keeps the proportions. */
  aspect: number;
}

export const ART_SLOTS: ArtSlot[] = [
  { id: "hall-lamppost-man", label: "نقاشی مرد و تیر چراغ (کنار ورودی)", place: "سالن شهربازی", default: `${T}/mural-lamppost-man.webp`, aspect: 1.03 },
  { id: "hall-batman-joker", label: "نقاشی بتمن و جوکر", place: "سالن شهربازی", default: `${T}/mural-batman-joker.webp`, aspect: 1.0 },
  { id: "hall-woman-lamp", label: "نقاشی زن و فانوس (کنار ایرهاکی)", place: "سالن شهربازی", default: `${T}/mural-woman-lamp.webp`, aspect: 2.69 },
  { id: "air-hockey-side", label: "طرح بدنهٔ میزهای ایرهاکی", place: "سالن شهربازی", default: `${T}/air-hockey-side-panel.webp`, aspect: 4.0 },
  { id: "upper-back", label: "نقاشی دیوار پشت فوت‌پول", place: "طبقهٔ دوم", default: `${T}/mural-upper-back.webp`, aspect: 3.25 },
  { id: "upper-dice", label: "نقاشی تاس‌ها", place: "طبقهٔ دوم", default: `${T}/mural-upper-dice.webp`, aspect: 1.7 },
  { id: "upper-cards", label: "نقاشی کارت‌ها", place: "طبقهٔ دوم", default: `${T}/mural-upper-cards.webp`, aspect: 1.44 },
  { id: "zone-excavator", label: "نقاشی بیل مکانیکی", place: "ماشین‌آلات راه‌سازی", default: `${T}/mural-excavator.webp`, aspect: 1.6 },
  { id: "gc-castle", label: "نقاشی قصر و کالسکه (سیستم ۳ و ۴)", place: "گیم‌نت", default: `${GC}/mural-castle.webp`, aspect: 2.29 },
  { id: "gc-paris", label: "نقاشی برج ایفل (سیستم ۱۱ و ۱۲)", place: "گیم‌نت", default: `${GC}/mural-paris.webp`, aspect: 2.0 },
  { id: "gc-portraits", label: "دیوار عکس‌ها و تابلوی cafe", place: "گیم‌نت", default: `${GC}/wall-portraits.webp`, aspect: 2.67 },
  { id: "gc-train", label: "نقاشی قطار (اتاق قطار)", place: "گیم‌نت", default: `${GC}/mural-train.webp`, aspect: 2.29 },
  { id: "gc-shelves", label: "قفسه‌های بنفش پشت پیشخوان", place: "گیم‌نت", default: `${GC}/counter-shelves.webp`, aspect: 1.85 },
  { id: "gc-controllers", label: "دیوار دسته‌های بازی", place: "گیم‌نت", default: `${GC}/controllers-wall.webp`, aspect: 1.6 },
  { id: "gc-stone", label: "دیوار سنگی", place: "گیم‌نت", default: `${GC}/stone-wall.webp`, aspect: 1.33 },
  { id: "gc-painting-paris", label: "تابلوی کوچک پاریس", place: "گیم‌نت", default: `${GC}/painting-paris.webp`, aspect: 1.5 },
  { id: "gc-poster-deer", label: "پوستر گوزن", place: "گیم‌نت", default: `${GC}/poster-deer.webp`, aspect: 0.67 },
  { id: "gc-street-door", label: "نمای پله‌ها از در خیابان", place: "ورودی", default: `${GC}/street-door-view.webp`, aspect: 0.5 },
];

export interface TextSlot {
  id: string;
  label: string;
  place: string;
  default: string;
  max: number;
}

/** Lettering in the 3D world. Place names (HUD, map, menu) are added by world/config.ts. */
export const TEXT_SLOTS: TextSlot[] = [
  { id: "hall-window", label: "نوشتهٔ شیشهٔ سالن", place: "ورودی", default: "شهربازی اتم", max: 30 },
  { id: "building-sign", label: "تابلوی سردر", place: "ورودی", default: "اتم گیم کلاب", max: 30 },
  { id: "gc-chalkboard-title", label: "متن تختهٔ گچی", place: "گیم‌نت", default: "برگزاری تورنومنت", max: 30 },
  { id: "gc-chalkboard-handle", label: "آیدی روی تختهٔ گچی", place: "گیم‌نت", default: "@ATOMgclub", max: 30 },
  { id: "gc-welcome", label: "تابلوی پایین پله‌ها", place: "گیم‌نت", default: "WELCOME", max: 20 },
];

let art: Record<string, string> = {};
let texts: Record<string, string> = {};
const byDefault = new Map(ART_SLOTS.map((s) => [s.default, s.id]));

/** Applies the manager's art and text changes (before a session starts). */
export function setSlotOverrides(a: Record<string, string>, t: Record<string, string>) {
  art = a;
  texts = t;
}

/** A built-in texture URL → the manager's replacement image, if any. */
export function resolveArt(url: string) {
  const id = byDefault.get(url);
  return (id && art[id]) || url;
}

export function artOverride(id: string): string | undefined {
  return art[id];
}

/** Text of a slot (or of a place name) with the manager's change applied. */
export function slotText(id: string, fallback?: string) {
  return texts[id] || fallback || TEXT_SLOTS.find((s) => s.id === id)?.default || "";
}
