import Link from "next/link";
import { Check, Clock, CreditCard } from "lucide-react";
import { BuyPlanButton } from "@/components/partners/buy-plan-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { VisiblePlan } from "@/features/partners/queries";
import { ENTITLEMENTS, type EntitlementKey } from "@/features/subscriptions/constants";
import { formatNumber, formatToman } from "@/lib/format";

/**
 * Plan list. Buyable plans get a pay button for approved partners (`canBuy`, partner panel) and a link to
 * the partner panel elsewhere; other plans show a disabled «به‌زودی».
 */
export function PlanCards({ plans, note, canBuy = false }: { plans: VisiblePlan[]; note: string; canBuy?: boolean }) {
  if (plans.length === 0) return <p className="rounded-xl border border-dashed bg-surface/60 p-6 text-center text-sm text-muted-foreground">{note}</p>;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((p) => (
          <div key={p.id} className="flex flex-col rounded-xl border bg-surface p-5 shadow-card">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold">{p.name}</h3>
              <Badge variant="secondary">{formatNumber(p.durationDays)} روزه</Badge>
            </div>
            <p className="mt-2 text-xl font-black">{BigInt(p.price) === BigInt(0) ? "رایگان" : formatToman(BigInt(p.price))}</p>
            {p.description ? <p className="mt-2 text-sm leading-7 text-muted-foreground">{p.description}</p> : null}
            {p.features.length > 0 ? (
              <ul className="mt-3 space-y-1 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2"><Check className="size-4 text-success" aria-hidden />{ENTITLEMENTS[f as EntitlementKey] ?? f}</li>
                ))}
              </ul>
            ) : null}
            <div className="mt-auto" />
            {p.purchasable && canBuy ? (
              <BuyPlanButton planId={p.id} />
            ) : p.purchasable ? (
              <Button asChild className="mt-4" variant="outline">
                <Link href="/partner"><CreditCard /> خرید از پنل همکار</Link>
              </Button>
            ) : (
              <Button className="mt-4" variant="secondary" disabled aria-disabled>
                <Clock /> به‌زودی
              </Button>
            )}
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{note}</p>
    </div>
  );
}
