import "server-only";
import { generateToken } from "@/lib/auth/crypto";
import type { PaymentProvider } from "../types";

/**
 * DEVELOPMENT-ONLY test gateway (refused in production by env validation).
 * Lets the full checkout → payment → callback flow be exercised without a real bank.
 */
export const sandboxProvider: PaymentProvider = {
  key: "sandbox",
  label: "درگاه آزمایشی (فقط محیط توسعه)",
  async createPayment({ amount, callbackUrl }) {
    const authority = `SBX-${generateToken(12)}`;
    const url = new URL("/payments/sandbox", callbackUrl);
    url.searchParams.set("authority", authority);
    url.searchParams.set("amount", amount.toString());
    url.searchParams.set("callback", callbackUrl);
    return { authority, redirectUrl: url.pathname + url.search };
  },
  async verifyPayment({ callbackParams }) {
    return callbackParams.get("status") === "OK"
      ? { ok: true, referenceId: `SBX-REF-${generateToken(6)}`, cardPanMasked: "6037-99**-****-1234" }
      : { ok: false, reason: "canceled_by_user" };
  },
};
