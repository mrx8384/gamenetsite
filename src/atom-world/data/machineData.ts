import type { TravelTarget } from "../world/types";

/**
 * Machines / attractions shown in the 3D world.
 *
 * This is the single source of truth for what the info panel shows. 3D components only reference a
 * machine by `id`. `price` stays null until the club records a real tariff on the site — the UI
 * then says the tariff is not registered yet (never show invented prices).
 */
export type MiniGameId = "air-hockey" | "construction-excavator" | "foot-pool" | "gc-controller" | "gc-city" | "gc-football" | "gc-console" | "face-paint";

export interface MachineInfo {
  id: string;
  name: string;
  /** Prompt shown when the player is close enough to interact. */
  prompt: string;
  emoji: string;
  description: string;
  /** Real photos of the machine in the club (paths under /public). */
  photos: { src: string; alt: string }[];
  /** Real tariff text from the site, or null when not registered. */
  price: string | null;
  /** Mini-game started from the info panel («شروع مینی‌گیم»). */
  miniGame: MiniGameId | null;
  /** If set, interacting moves the player to this environment instead of opening the info panel. */
  travel?: TravelTarget;
  /** Buttons to pages of the main site (paths relative to the site root). */
  links?: { label: string; href: string }[];
  /** Hide the tariff block (for services that are not a game). */
  noPrice?: boolean;
  /** Shown in the menu's list of games & services (default true). */
  listed?: boolean;
  /** Interacting opens this panel instead of the info panel. */
  opens?: "events";
}

export const machines = {
  "face-paint": {
    id: "face-paint",
    name: "گریم صورت کودکان",
    prompt: "🎨 گریم صورت",
    emoji: "🎨",
    description:
      "میز آرایش با آینهٔ چراغ‌دار روی فرش گوشهٔ کودکان: بچه‌ها طرح دلخواهشان (ستاره، قلب، پروانه، گربه، رنگین‌کمان، ببر یا گل) را انتخاب می‌کنند و روی صورتشان نقاشی می‌شود. در مینی‌گیم، شما گریم‌کار هستید.",
    photos: [],
    price: null,
    miniGame: "face-paint",
  },
  "air-hockey": {
    id: "air-hockey",
    name: "ایرهاکی",
    prompt: "🏒 مشاهده بازی ایرهاکی",
    emoji: "🏒",
    description:
      "میزهای ایرهاکی طبقهٔ همکف مجموعه با سطح بادی سفید، نورپردازی LED دور میز و تابلوی امتیاز روی کمان وسط. بازی دونفره است: هر بازیکن با دستهٔ خود دیسک را به سمت دروازهٔ حریف می‌زند.",
    photos: [
      { src: "/atom-world/photos/air-hockey-left-wall.webp", alt: "میزهای ایرهاکی کنار دیوار نقاشی‌شده" },
      { src: "/atom-world/photos/hall-overview.webp", alt: "نمای کلی سالن طبقهٔ همکف" },
    ],
    price: null,
    miniGame: "air-hockey",
  },
  "construction-machines": {
    id: "construction-machines",
    name: "دنیای ماشین‌آلات راه‌سازی (RC کلاب)",
    prompt: "🚜 معرفی بازی ماشین‌آلات راه‌سازی",
    emoji: "🚜",
    description:
      "محوطهٔ خاکی محصور با بیل‌های مکانیکی و کامیون‌های کنترلی کوچک، مسیرهای خاکی، جدول‌ها، فضای دایره‌ای وسط و پل چوبی کوچک؛ روی دیوار اصلی نقاشی بزرگ بیل مکانیکی زرد و نارنجی کشیده شده است. محل دقیق این بخش در ساختمان هنوز تأیید نشده و فعلاً به‌صورت بخش مستقل نمایش داده می‌شود.",
    photos: [{ src: "/atom-world/photos/construction-zone.webp", alt: "محوطهٔ ماشین‌آلات راه‌سازی" }],
    price: null,
    miniGame: "construction-excavator",
  },
  "foot-pool": {
    id: "foot-pool",
    name: "فوت‌پول (بیلیارد فوتبالی)",
    prompt: "⚽ مشاهده زمین فوت‌پول",
    emoji: "⚽",
    description:
      "زمین بزرگ بیلیارد در طبقهٔ دوم با فرش سرمه‌ای، دیواره‌های سفید با رویهٔ خاکستری و شش جیب با نورپردازی نارنجی. در این بازی توپ‌ها با ضربهٔ پا به سمت جیب‌ها زده می‌شوند.",
    photos: [{ src: "/atom-world/photos/foot-pool-field-and-mural.webp", alt: "زمین فوت‌پول طبقهٔ دوم" }],
    price: null,
    miniGame: "foot-pool",
  },
  "footballs-table": {
    id: "footballs-table",
    name: "میز بازی FOOTBALLS",
    prompt: "🥅 مشاهده میز FOOTBALLS",
    emoji: "🥅",
    description:
      "دو میز بازی FOOTBALLS در طبقهٔ دوم با بدنهٔ فلزی مشکی، قفس و تور محافظ، نشیمن‌های قرمز و تابلوی امتیاز دستی. توضیح نحوهٔ بازی پس از تأیید مجموعه تکمیل می‌شود.",
    photos: [{ src: "/atom-world/photos/footballs-tables-gray-sofa.webp", alt: "میزهای FOOTBALLS و مبل خاکستری" }],
    price: null,
    miniGame: null,
  },
  "shop-counter": {
    id: "shop-counter",
    name: "پیشخوان و فروشگاه اتم",
    prompt: "🛍️ پیشخوان و فروشگاه اتم",
    emoji: "🛍️",
    description:
      "پیشخوان مجموعه در طبقهٔ همکف، کنار راه‌پله، با لوگوی بزرگ اتم، قفسهٔ اسباب‌بازی‌ها و یخچال نوشیدنی. محصولات فروشگاه اتم را می‌توانید در فروشگاه آنلاین سایت ببینید.",
    photos: [{ src: "/atom-world/photos/hall-overview.webp", alt: "پیشخوان اتم سمت راست سالن" }],
    price: null,
    miniGame: null,
    noPrice: true,
    links: [{ label: "ورود به فروشگاه آنلاین اتم", href: "/shop" }],
  },
  "gc-ps5": {
    id: "gc-ps5",
    name: "پلی‌استیشن ۵ — سیستم ۱ گیم‌نت",
    prompt: "🎮 سیستم ۱ (پلی‌استیشن ۵)",
    emoji: "🎮",
    description:
      "سیستم شمارهٔ ۱ گیم‌نت اتم با کنسول پلی‌استیشن ۵، جلوی پیشخوان: تلویزیون روی میز مشکی و مبل خاکستری روبه‌روی آن. گیم‌نت در زیرزمین مجموعه است؛ از درِ زیر تابلوی نارنجی «اتم گیم کلاب» پله‌ها را پایین بروید، پیشخوان سمت راست است.",
    photos: [
      { src: "/atom-world/envs/gaming-center/photos/03-counter-shop-purple-shelves.webp", alt: "پیشخوان گیم‌نت و سیستم جلوی آن" },
      { src: "/atom-world/envs/gaming-center/photos/15-street-facade-sign.webp", alt: "در ورودی گیم‌نت زیر تابلوی اتم گیم کلاب" },
    ],
    price: null,
    miniGame: "gc-console",
  },
  "gc-ps4": {
    id: "gc-ps4",
    name: "پلی‌استیشن ۴ — سیستم‌های ۲ تا ۱۳ گیم‌نت",
    prompt: "🎮 سیستم پلی‌استیشن ۴",
    emoji: "🎮",
    description:
      "سیستم‌های ۲ تا ۱۳ گیم‌نت با کنسول پلی‌استیشن ۴. هر سیستم یک تلویزیون روی میز پایین و مبل یا صندلی‌های خاکستری دارد و شماره‌اش روی تابلوی دسته‌بازی‌شکل روی دیوار است: ۲ کنار تختهٔ تورنومنت، ۳ و ۴ روی نقاشی قصر، ۵ و ۶ روبه‌روی پیشخوان، ۸ تا ۱۰ روی دیوار عکس‌ها، ۱۱ و ۱۲ روی نقاشی پاریس و ۱۳ در اتاق قطار.",
    photos: [
      { src: "/atom-world/envs/gaming-center/photos/10-long-view-paris-cafe-london.webp", alt: "سالن گیم‌نت با نقاشی پاریس و دیوار عکس‌ها" },
      { src: "/atom-world/envs/gaming-center/photos/02-room-train-mural-tv.webp", alt: "اتاق قطار گیم‌نت" },
    ],
    price: null,
    miniGame: "gc-console",
  },
  "gc-counter": {
    id: "gc-counter",
    name: "پیشخوان گیم‌نت",
    prompt: "🛍️ پیشخوان گیم‌نت",
    emoji: "🛍️",
    description:
      "پیشخوان چوبی گیم‌نت با لوگوی فنجان قهوه، قفسه‌های با نور بنفش (کنسول‌ها و بازی‌ها)، «گردونه شانس»، یخچال نوشیدنی و دیوار دسته‌های بازی.",
    photos: [{ src: "/atom-world/envs/gaming-center/photos/03-counter-shop-purple-shelves.webp", alt: "پیشخوان و قفسه‌های بنفش گیم‌نت" }],
    price: null,
    miniGame: null,
    noPrice: true,
    links: [{ label: "ورود به فروشگاه آنلاین اتم", href: "/shop" }],
  },
  "gc-tournament-board": {
    id: "gc-tournament-board",
    name: "تختهٔ «برگزاری تورنومنت»",
    prompt: "📣 تورنومنت‌ها و رویدادها",
    emoji: "📣",
    description: "",
    photos: [],
    price: null,
    miniGame: null,
    noPrice: true,
    listed: false,
    opens: "events",
  },
  "events-board": {
    id: "events-board",
    name: "تابلوی تورنومنت‌ها و رویدادها",
    prompt: "📣 تورنومنت‌ها و رویدادها",
    emoji: "📣",
    description: "",
    photos: [],
    price: null,
    miniGame: null,
    noPrice: true,
    listed: false,
    opens: "events",
  },
} satisfies Record<string, MachineInfo>;
