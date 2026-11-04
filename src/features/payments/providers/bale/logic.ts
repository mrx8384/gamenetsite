/**
 * Pure rules of the Bale wallet gateway (no network, no database) — unit-tested.
 * Docs: docs.bale.ai → پرداخت (sendInvoice, answerPreCheckoutQuery, SuccessfulPayment, inquireTransaction).
 */

/** Payment code carried in the bot link (`?start=`) and in the invoice payload. */
export const BALE_CODE_RE = /^ATOM[A-Za-z0-9_-]{16,40}$/;

/** Reads the payment code from «/start CODE», «/startCODE» or the code pasted on its own. */
export function codeFromMessage(text: string | undefined | null): string | null {
  const t = (text ?? "").trim();
  const m = t.match(/^\/start(?:@\w+)?\s+(\S+)$/) ?? t.match(/^(\S+)$/);
  const code = m?.[1] ?? "";
  return BALE_CODE_RE.test(code) ? code : null;
}

const cut = (s: string, max: number) => (s.length <= max ? s : s.slice(0, max - 1) + "…");

/**
 * sendInvoice body. Title ≤ 32 chars, description ≤ 255, payload ≤ 128 bytes, amounts in Rials.
 * `title` names what is paid for, e.g. «سفارش ATM-123456» or «اشتراک طلایی».
 */
export function invoiceParams(p: { chatId: number | string; code: string; title: string; amountRial: bigint; providerToken: string; siteName: string }) {
  if (p.amountRial <= BigInt(0) || p.amountRial > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("amount out of range");
  return {
    chat_id: p.chatId,
    title: cut(p.title, 32),
    description: cut(`پرداخت ${p.title} — ${p.siteName}`, 255),
    payload: p.code,
    provider_token: p.providerToken,
    prices: [{ label: cut(p.title, 32), amount: Number(p.amountRial) }],
  };
}

export interface PayableState {
  paymentStatus: string;
  /** What the payment is for is still waiting for it (not expired or cancelled). */
  open: boolean;
  amountRial: bigint;
}

/** Decision for a pre_checkout_query (must be answered within 10 s). */
export function checkPreCheckout(state: PayableState | null, query: { currency?: string; total_amount?: number }): { ok: true } | { ok: false; message: string } {
  if (!state || state.paymentStatus !== "INITIATED") return { ok: false, message: "این درخواست پرداخت معتبر نیست؛ از سایت دوباره اقدام کنید." };
  if (!state.open) return { ok: false, message: "مهلت این پرداخت تمام شده است؛ از سایت دوباره اقدام کنید." };
  if ((query.currency ?? "IRR") !== "IRR" || BigInt(query.total_amount ?? -1) !== state.amountRial) {
    return { ok: false, message: "مبلغ پرداخت درست نیست؛ از سایت دوباره اقدام کنید." };
  }
  return { ok: true };
}

export interface BaleTransaction {
  id?: string;
  status?: string;
  amount?: number;
  userID?: number;
}

/** A payment counts only when Bale's own record says «paid» for exactly the order amount. */
export function transactionResult(tx: BaleTransaction | null, amountRial: bigint): { ok: true } | { ok: false; reason: string; pending?: boolean } {
  if (!tx) return { ok: false, reason: "no_transaction", pending: true };
  if (tx.status === "pending") return { ok: false, reason: "pending", pending: true };
  if (tx.status !== "paid") return { ok: false, reason: `status_${tx.status ?? "unknown"}` };
  if (BigInt(tx.amount ?? -1) !== amountRial) return { ok: false, reason: "amount_mismatch" };
  return { ok: true };
}

/** Link that opens the bot in Bale with the payment code. */
export function botLink(username: string, code: string): string {
  return `https://ble.ir/${encodeURIComponent(username.replace(/^@/, ""))}?start=${encodeURIComponent(code)}`;
}
