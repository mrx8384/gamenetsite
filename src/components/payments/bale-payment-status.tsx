"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";

/** Checks every few seconds whether Bale confirmed the payment, then opens the order page. */
export function BalePaymentStatus({ code }: { code: string }) {
  const router = useRouter();
  const [state, setState] = React.useState<"pending" | "expired" | "failed">("pending");

  React.useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const res = await fetch(`/api/payments/bale/status?code=${encodeURIComponent(code)}`, { cache: "no-store" });
        const data = (await res.json()) as { status?: string; orderNumber?: string };
        if (stop) return;
        if (data.status === "paid" && data.orderNumber) return router.replace(`/account/orders/${encodeURIComponent(data.orderNumber)}?payment=paid`);
        if (data.status === "expired" || data.status === "failed") return setState(data.status);
      } catch {
        // offline for a moment: keep trying
      }
      if (!stop) timer = setTimeout(tick, document.visibilityState === "visible" ? 3000 : 10000);
    };
    timer = setTimeout(tick, 2000);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [code, router]);

  if (state === "expired") return <p role="status" className="text-sm font-medium text-destructive">مهلت پرداخت این سفارش تمام شده است. از صفحهٔ سفارش‌ها دوباره اقدام کنید.</p>;
  if (state === "failed") return <p role="status" className="text-sm font-medium text-destructive">پرداخت ناموفق بود. از صفحهٔ سفارش‌ها دوباره اقدام کنید.</p>;
  return (
    <p role="status" className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <Spinner className="size-4" /> در انتظار پرداخت در بله…
    </p>
  );
}
