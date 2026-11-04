"use client";

import * as React from "react";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buySubscription } from "@/features/subscriptions/purchase-actions";

export function BuyPlanButton({ planId }: { planId: string }) {
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      className="mt-4"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await buySubscription(planId);
          if (!res.ok) return void toast.error(res.error);
          window.location.assign(res.data.redirectTo); // gateway page (may be external)
        })
      }
    >
      <CreditCard /> خرید و پرداخت آنلاین
    </Button>
  );
}
