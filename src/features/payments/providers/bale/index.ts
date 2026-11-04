import "server-only";
import { generateToken } from "@/lib/auth/crypto";
import type { PaymentProvider } from "../../types";
import { bale, isTestToken } from "./api";
import { transactionResult, type BaleTransaction } from "./logic";

/**
 * «پرداخت با کیف پول بله». The customer pays inside the Bale app: the order page links to our bot with a
 * payment code, the bot sends a money request (sendInvoice), and Bale reports the result to our webhook
 * (src/app/api/payments/bale/webhook). Nothing is marked paid until inquireTransaction says «paid».
 */
export const baleProvider: PaymentProvider = {
  key: "bale",
  get label() {
    return isTestToken() ? "کیف پول بله (آزمایشی — بدون انتقال پول)" : "کیف پول بله";
  },
  get testMode() {
    return isTestToken();
  },
  async createPayment() {
    const authority = `ATOM${generateToken(15)}`; // 20 url-safe characters after the prefix
    return { authority, redirectUrl: `/payments/bale?code=${encodeURIComponent(authority)}` };
  },
  async verifyPayment({ amount, callbackParams }) {
    const id = callbackParams.get("transaction_id");
    if (!id) return { ok: false, reason: "no_transaction" };
    const tx = await bale<BaleTransaction>("inquireTransaction", { transaction_id: id });
    const r = transactionResult(tx, amount);
    return r.ok ? { ok: true, referenceId: String(tx.id ?? id), raw: tx } : { ok: false, reason: r.reason, raw: tx };
  },
};
