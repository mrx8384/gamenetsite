import { z } from "zod";
import { toEnglishDigits } from "@/lib/format";

/**
 * Editable site texts and contact info. One definition drives the admin forms,
 * server validation and defaults. Stored in site_settings under key `site.<group>`.
 */
export type FieldType = "text" | "textarea" | "url" | "phone" | "email";
export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  max: number;
  default: string;
  hint?: string;
}
export interface GroupDef {
  label: string;
  description: string;
  fields: FieldDef[];
}

export const SITE_GROUPS = {
  home: {
    label: "صفحهٔ اصلی",
    description: "متن‌های بخش‌های صفحهٔ اصلی.",
    fields: [
      { key: "heroEyebrow", label: "برچسب بالای تیتر اصلی", type: "text", max: 60, default: "از ۲۰۲۱ در کنار گیمرها" },
      { key: "heroTitle", label: "تیتر اصلی", type: "text", max: 80, default: "جایی برای بازی، رقابت و خرید" },
      { key: "heroSubtitle", label: "متن زیر تیتر اصلی", type: "textarea", max: 300, default: "فروشگاه محصولات گیمینگ، کاتالوگ بازی‌های PS4 و PS5، تورنومنت‌های FC و خدمات ویژهٔ همکاران — همه در آتم گیم کلاب." },
      { key: "shopTitle", label: "عنوان بخش فروشگاه", type: "text", max: 60, default: "فروشگاه آتم" },
      { key: "shopSubtitle", label: "توضیح بخش فروشگاه", type: "text", max: 200, default: "محصولات منتخب گیمینگ با قیمت شفاف و ارسال مطمئن." },
      { key: "catalogTitle", label: "عنوان بخش کاتالوگ", type: "text", max: 60, default: "کاتالوگ بازی‌ها" },
      { key: "catalogSubtitle", label: "توضیح بخش کاتالوگ", type: "text", max: 200, default: "ببینید چه بازی‌هایی در آتم آمادهٔ اجراست؛ جدا برای PS4 و PS5، با جست‌وجو و دسته‌بندی." },
      { key: "tournamentsTitle", label: "عنوان بخش تورنومنت", type: "text", max: 60, default: "تورنومنت‌های FC" },
      { key: "tournamentsSubtitle", label: "توضیح بخش تورنومنت", type: "textarea", max: 300, default: "مسابقات FIFA و EA SPORTS FC با ثبت‌نام آنلاین، جدول مسابقات و اعلام نتایج. این بخش در حال آماده‌سازی است." },
      { key: "partnersTitle", label: "عنوان بخش همکاران", type: "text", max: 60, default: "خدمات همکاران" },
      { key: "partnersSubtitle", label: "توضیح بخش همکاران", type: "text", max: 200, default: "برای گیم‌نت‌ها، فروشگاه‌ها و تیم‌های ای‌اسپورت: پنل اختصاصی و ابزارهای حرفه‌ای." },
      { key: "partner1Title", label: "ویژگی ۱ — عنوان", type: "text", max: 60, default: "پنل اختصاصی همکار" },
      { key: "partner1Body", label: "ویژگی ۱ — توضیح", type: "text", max: 160, default: "وضعیت درخواست، اشتراک و ابزارها در یک داشبورد." },
      { key: "partner2Title", label: "ویژگی ۲ — عنوان", type: "text", max: 60, default: "تست دسته (Gamepad Tester)" },
      { key: "partner2Body", label: "ویژگی ۲ — توضیح", type: "text", max: 160, default: "ابزار بررسی سلامت دسته‌ها برای همکاران دارای اشتراک فعال." },
      { key: "partner3Title", label: "ویژگی ۳ — عنوان", type: "text", max: 60, default: "همکاری در تورنومنت‌ها" },
      { key: "partner3Body", label: "ویژگی ۳ — توضیح", type: "text", max: 160, default: "میزبانی و برگزاری مسابقات با پشتیبانی آتم." },
      { key: "newsTitle", label: "عنوان بخش اخبار", type: "text", max: 60, default: "تازه‌ترین اخبار" },
      { key: "newsSubtitle", label: "توضیح بخش اخبار", type: "text", max: 200, default: "اخبار دنیای بازی و رویدادهای آتم." },
      { key: "aboutTitle", label: "عنوان بخش درباره ما", type: "text", max: 60, default: "دربارهٔ آتم گیم کلاب" },
      { key: "aboutBody", label: "متن کوتاه درباره ما", type: "textarea", max: 600, default: "آتم گیم کلاب از سال ۲۰۲۱ فعالیت خود را آغاز کرده است. هدف ما ساختن فضایی حرفه‌ای و صمیمی برای گیمرهاست؛ از تجربهٔ بازی و رقابت گرفته تا خرید مطمئن محصولات گیمینگ." },
    ],
  },
  contact: {
    label: "تماس و شبکه‌های اجتماعی",
    description: "در صفحهٔ تماس با ما و فوتر نمایش داده می‌شود. فیلدهای خالی نمایش داده نمی‌شوند.",
    fields: [
      { key: "phone", label: "تلفن", type: "phone", max: 20, default: "" },
      { key: "mobile", label: "موبایل / واتس‌اپ", type: "phone", max: 20, default: "" },
      { key: "email", label: "ایمیل", type: "email", max: 120, default: "" },
      { key: "address", label: "نشانی", type: "textarea", max: 300, default: "" },
      { key: "hours", label: "ساعات کاری", type: "text", max: 120, default: "", hint: "مثلاً شنبه تا پنجشنبه، ۱۰ تا ۲۲" },
      { key: "mapUrl", label: "لینک نقشه (نشان، بلد یا گوگل)", type: "url", max: 300, default: "" },
      { key: "instagram", label: "اینستاگرام", type: "url", max: 200, default: "", hint: "آدرس کامل، مثلاً https://instagram.com/..." },
      { key: "telegram", label: "تلگرام", type: "url", max: 200, default: "" },
      { key: "whatsapp", label: "واتس‌اپ", type: "url", max: 200, default: "" },
      { key: "eitaa", label: "ایتا", type: "url", max: 200, default: "" },
      { key: "bale", label: "بله", type: "url", max: 200, default: "" },
      { key: "aparat", label: "آپارات", type: "url", max: 200, default: "" },
      { key: "youtube", label: "یوتیوب", type: "url", max: 200, default: "" },
    ],
  },
  general: {
    label: "عمومی و فوتر",
    description: "توضیحات سایت (برای موتورهای جست‌وجو) و متن‌های فوتر.",
    fields: [
      { key: "siteDescription", label: "توضیح سایت (سئو)", type: "textarea", max: 300, default: "باشگاه گیمینگ آتم؛ فروشگاه، کاتالوگ بازی‌ها، تورنومنت‌ها و خدمات همکاران." },
      { key: "footerDescription", label: "متن معرفی در فوتر", type: "textarea", max: 300, default: "باشگاه گیمینگ آتم؛ فروشگاه، کاتالوگ بازی‌ها، تورنومنت‌ها و خدمات همکاران." },
      { key: "footerSince", label: "متن سال تأسیس در فوتر", type: "text", max: 60, default: "فعالیت از سال ۲۰۲۱" },
      { key: "copyright", label: "متن حق نشر", type: "text", max: 120, default: "آتم گیم کلاب — تمامی حقوق محفوظ است." },
    ],
  },
  tournaments: {
    label: "تورنومنت",
    description: "متن‌های صفحهٔ تورنومنت‌ها و تست دسته.",
    fields: [
      { key: "comingSoon", label: "پیام صفحهٔ تورنومنت", type: "text", max: 120, default: "بخش تورنومنت به‌زودی فعال می‌شود." },
      { key: "badge", label: "برچسب بازی‌ها", type: "text", max: 60, default: "FIFA · EA SPORTS FC" },
      { key: "gamepadTesterText", label: "متن صفحهٔ تست دسته", type: "textarea", max: 300, default: "ابزار تست دسته برای همکاران دارای اشتراک فعال، به‌زودی در دسترس قرار می‌گیرد." },
    ],
  },
} as const satisfies Record<string, GroupDef>;

export type SiteGroupKey = keyof typeof SITE_GROUPS;
export type SiteGroupValues<G extends SiteGroupKey> = { [K in (typeof SITE_GROUPS)[G]["fields"][number]["key"]]: string };

export function isSiteGroup(v: unknown): v is SiteGroupKey {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(SITE_GROUPS, v);
}

function fieldSchema(f: FieldDef) {
  const base = z.string().trim().max(f.max, `حداکثر ${f.max.toLocaleString("fa-IR")} کاراکتر`);
  switch (f.type) {
    case "url":
      return base.refine((v) => v === "" || /^https:\/\/[^\s<>"]+$/i.test(v), "آدرس باید با https:// شروع شود");
    case "email":
      return base.refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), "ایمیل معتبر نیست");
    case "phone":
      return base
        .transform((v) => toEnglishDigits(v).replace(/[\s-]/g, ""))
        .pipe(z.string().regex(/^(\+?\d{4,15})?$/, "شمارهٔ تلفن معتبر نیست"));
    default:
      return base;
  }
}

/** Zod schema for one group; missing keys fall back to "" (cleared). */
export function groupSchema(group: SiteGroupKey) {
  const shape: Record<string, z.ZodType> = {};
  for (const f of SITE_GROUPS[group].fields as readonly FieldDef[]) shape[f.key] = z.preprocess((v) => (v == null ? "" : v), fieldSchema(f));
  return z.object(shape);
}

export function groupDefaults<G extends SiteGroupKey>(group: G): SiteGroupValues<G> {
  return Object.fromEntries((SITE_GROUPS[group].fields as readonly FieldDef[]).map((f) => [f.key, f.default])) as SiteGroupValues<G>;
}
