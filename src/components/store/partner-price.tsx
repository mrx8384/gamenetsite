import { Handshake } from "lucide-react";
import { partnerPricesForRequest } from "@/features/partners/pricing";
import { formatToman } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * «قیمت همکار» line, rendered per request for approved partners only (never part of cached pages).
 * Wrap in <Suspense fallback={null}>.
 */
export async function PartnerPriceLine({ productId, size = "md" }: { productId: string; size?: "md" | "lg" }) {
  const prices = await partnerPricesForRequest();
  const p = prices?.get(productId);
  if (p === undefined) return null;
  return (
    <p className={cn("flex items-center gap-1.5 rounded-lg bg-brand-green/10 px-2 py-1 font-bold text-link", size === "lg" ? "text-base" : "text-xs")}>
      <Handshake className={size === "lg" ? "size-5" : "size-3.5"} aria-hidden /> قیمت همکار: {formatToman(p)}
    </p>
  );
}
