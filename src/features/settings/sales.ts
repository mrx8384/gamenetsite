import "server-only";
import { getPaymentProvider } from "@/features/payments";
import { getCommerceSettings } from "./commerce";
import { getSectionVisibility } from "./sections";

/** Online sales are open only when the admin switch is on, a gateway is configured and the shop is not hidden. */
export async function isSalesOpen(): Promise<boolean> {
  const [settings, visibility] = await Promise.all([getCommerceSettings(), getSectionVisibility()]);
  return settings.salesEnabled && getPaymentProvider() !== null && visibility.shop;
}
