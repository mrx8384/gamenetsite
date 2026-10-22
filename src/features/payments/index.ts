import "server-only";
import { env } from "@/lib/env";
import { sandboxProvider } from "./providers/sandbox";
import type { PaymentProvider } from "./types";

/** The active gateway, or null while payments are disabled. Real providers are registered here. */
export function getPaymentProvider(): PaymentProvider | null {
  switch (env.PAYMENT_PROVIDER) {
    case "sandbox":
      return env.NODE_ENV === "production" ? null : sandboxProvider;
    default:
      return null;
  }
}

export function getPaymentProviderByKey(key: string): PaymentProvider | null {
  const p = getPaymentProvider();
  return p && p.key === key ? p : null;
}
