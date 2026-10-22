import "server-only";
import { getPaymentProvider } from "@/features/payments";
import { getCommerceSettings } from "./commerce";

/** Online sales are open only when the admin switch is on AND a gateway is configured. */
export async function isSalesOpen(): Promise<boolean> {
  const settings = await getCommerceSettings();
  return settings.salesEnabled && getPaymentProvider() !== null;
}
