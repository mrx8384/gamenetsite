/**
 * Persian (fa-IR) display helpers.
 * Money is stored as integer Rials (bigint) and shown as Toman (1 Toman = 10 Rials).
 */

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function toPersianDigits(input: string | number | bigint): string {
  return String(input).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

/** Normalizes Persian/Arabic digits typed by users to ASCII digits. */
export function toEnglishDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
}

const numberFormatter = new Intl.NumberFormat("fa-IR");

export function formatNumber(value: number | bigint): string {
  return numberFormatter.format(value);
}

/** Rials → whole Tomans (truncates sub-Toman remainder, which should not occur in practice). */
export function rialToToman(rial: bigint): bigint {
  return rial / BigInt(10);
}

export function tomanToRial(toman: bigint | number): bigint {
  return BigInt(toman) * BigInt(10);
}

/** e.g. 1250000n (Rial) → "۱۲۵٬۰۰۰ تومان" */
export function formatToman(rial: bigint): string {
  return `${formatNumber(rialToToman(rial))} تومان`;
}

const dateFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "Asia/Tehran",
});

const dateTimeFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Tehran",
});

/** Jalali date in Tehran time, e.g. "۳۰ مهر ۱۴۰۵". */
export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

export function formatDateTime(date: Date): string {
  return dateTimeFormatter.format(date);
}
