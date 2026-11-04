/** Automatic product codes: ATM-00001, ATM-00002, … (pure helpers, unit-tested). */
export const AUTO_SKU_PREFIX = "ATM-";
const AUTO_RE = /^ATM-(\d+)$/;

export const formatAutoSku = (n: number) => `${AUTO_SKU_PREFIX}${String(n).padStart(5, "0")}`;

/** Next free automatic code after the highest existing ATM-number (manual codes in other shapes are ignored). */
export function nextAutoSku(existing: string[]): string {
  let max = 0;
  for (const s of existing) {
    const m = AUTO_RE.exec(s);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return formatAutoSku(max + 1);
}
