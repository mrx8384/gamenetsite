import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCartCount } from "@/features/cart/queries";
import { isSalesOpen } from "@/features/settings/sales";
import { getCurrentUser } from "@/lib/auth/dal";
import { toPersianDigits } from "@/lib/format";

/** Header cart link with item count. Hidden while online sales are closed. */
export async function CartButton() {
  if (!(await isSalesOpen())) return null;
  const user = await getCurrentUser();
  const count = await getCartCount(user?.id ?? null);
  return (
    <Button asChild variant="ghost" size="icon" className="relative" aria-label={`سبد خرید${count ? ` (${count} کالا)` : ""}`}>
      <Link href="/cart">
        <ShoppingCart className="size-5!" />
        {count > 0 ? (
          <span className="absolute -end-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-green px-1 text-[11px] font-bold text-brand-black">
            {toPersianDigits(count > 99 ? "99+" : count)}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}
