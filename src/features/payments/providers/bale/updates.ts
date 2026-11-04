import "server-only";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { applyGatewayResult, findPaymentTarget } from "@/features/payments/targets";
import { bale } from "./api";
import { baleProvider } from "./index";
import { checkPreCheckout, codeFromMessage, invoiceParams } from "./logic";

/** The parts of a Bale update this gateway reads (everything else is ignored). */
export interface BaleUpdate {
  update_id?: number;
  message?: {
    chat?: { id?: number | string };
    text?: string;
    successful_payment?: { currency?: string; total_amount?: number; invoice_payload?: string; telegram_payment_charge_id?: string; provider_payment_charge_id?: string };
  };
  pre_checkout_query?: { id?: string; currency?: string; total_amount?: number; invoice_payload?: string };
}

const site = () => env.APP_URL.replace(/\/+$/, "");
const say = (chatId: number | string, text: string) => bale("sendMessage", { chat_id: chatId, text }).catch((e) => console.error("[bale] sendMessage failed:", e instanceof Error ? e.message : e));

const paymentByCode = (code: string) => findPaymentTarget({ provider_authority: { provider: "bale", authority: code } });

/** «/start CODE» (from the site's link) or the pasted code → send the money request for that order. */
async function onMessage(chatId: number | string, text: string | undefined) {
  const code = codeFromMessage(text);
  if (!code) {
    await say(chatId, `سلام! برای پرداخت، در سایت ${site()} سفارش، اشتراک یا ثبت‌نام تورنومنت را شروع کنید و در صفحهٔ پرداخت روی «پرداخت در بله» بزنید.`);
    return;
  }
  const p = await paymentByCode(code);
  if (!p) return void (await say(chatId, "این کد پرداخت پیدا نشد؛ از سایت دوباره اقدام کنید."));
  if (p.status === "SUCCEEDED") return void (await say(chatId, `${p.title} قبلاً پرداخت شده است. ✅`));
  const check = checkPreCheckout({ paymentStatus: p.status, open: p.open, amountRial: p.amount }, { currency: "IRR", total_amount: Number(p.amount) });
  if (!check.ok) return void (await say(chatId, check.message));
  await bale("sendInvoice", invoiceParams({ chatId, code, title: p.title, amountRial: p.amount, providerToken: env.BALE_PROVIDER_TOKEN!, siteName: "اتم گیم کلاب" }));
}

/** Bale asks for a final OK just before taking the money (10-second limit). */
async function onPreCheckout(q: NonNullable<BaleUpdate["pre_checkout_query"]>) {
  if (!q.id) return;
  const p = q.invoice_payload ? await paymentByCode(q.invoice_payload) : null;
  const check = checkPreCheckout(p ? { paymentStatus: p.status, open: p.open, amountRial: p.amount } : null, q);
  await bale("answerPreCheckoutQuery", check.ok ? { pre_checkout_query_id: q.id, ok: true } : { pre_checkout_query_id: q.id, ok: false, error_message: check.message });
}

/**
 * Confirms a payment with inquireTransaction and applies it (order, subscription or tournament entry). Also used by the payment page's
 * status check, so a payment whose confirmation failed once (network) is picked up later.
 */
export async function confirmBalePayment(paymentId: string, transactionId: string): Promise<"paid" | "pending" | "failed" | "already_processed" | "late_paid_needs_refund"> {
  const p = await db.payment.findUnique({ where: { id: paymentId }, select: { status: true, amount: true, raw: true } });
  if (!p) return "failed";
  if (p.status !== "INITIATED") return p.status === "SUCCEEDED" ? "already_processed" : "failed";
  // Remember the transaction first, so it can be re-checked if Bale can't be reached right now.
  const raw = (p.raw && typeof p.raw === "object" ? p.raw : {}) as Record<string, unknown>;
  if (raw.baleTransactionId !== transactionId) await db.payment.update({ where: { id: paymentId }, data: { raw: { ...raw, baleTransactionId: transactionId } } });
  const result = await baleProvider.verifyPayment({ authority: "", amount: p.amount, callbackParams: new URLSearchParams({ transaction_id: transactionId }) });
  if (!result.ok && (result.reason === "pending" || result.reason === "no_transaction")) return "pending";
  const outcome = await applyGatewayResult(paymentId, result.ok ? { ...result, raw: { baleTransactionId: transactionId, transaction: result.raw } } : result);
  return outcome.result;
}

async function onSuccessfulPayment(chatId: number | string | undefined, sp: NonNullable<NonNullable<BaleUpdate["message"]>["successful_payment"]>) {
  const code = sp.invoice_payload ?? "";
  const txId = sp.telegram_payment_charge_id ?? "";
  const p = code ? await paymentByCode(code) : null;
  if (!p || !txId) {
    console.error("[bale] successful_payment for unknown payment", { hasCode: !!code, hasTx: !!txId });
    return;
  }
  const result = await confirmBalePayment(p.paymentId, txId);
  if (chatId === undefined) return;
  if (result === "paid" || result === "already_processed") {
    await say(chatId, `✅ پرداخت ${p.title} انجام شد${sp.provider_payment_charge_id ? ` (کد پیگیری: ${sp.provider_payment_charge_id})` : ""}.\nجزئیات: ${site()}${p.returnPath}`);
  } else if (result === "late_paid_needs_refund") {
    await say(chatId, `پرداخت ${p.title} انجام شد، اما ثبت آن دیگر ممکن نبود (مثلاً ظرفیت تکمیل شده بود). مبلغ توسط اتم گیم کلاب بازگردانده می‌شود؛ برای پیگیری با پشتیبانی تماس بگیرید.`);
  } else if (result === "pending") {
    await say(chatId, `پرداخت ${p.title} در حال تأیید است؛ نتیجه در سایت نمایش داده می‌شود.`);
  } else {
    await say(chatId, `پرداخت ${p.title} تأیید نشد. اگر مبلغی کم شده، با پشتیبانی اتم تماس بگیرید.`);
  }
}

export async function handleBaleUpdate(u: BaleUpdate): Promise<void> {
  if (u.pre_checkout_query) return onPreCheckout(u.pre_checkout_query);
  const m = u.message;
  if (!m) return;
  if (m.successful_payment) return onSuccessfulPayment(m.chat?.id, m.successful_payment);
  if (m.chat?.id !== undefined && typeof m.text === "string") return onMessage(m.chat.id, m.text);
}
