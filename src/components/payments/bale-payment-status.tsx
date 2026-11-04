"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";

/** Checks every few seconds whether Bale confirmed the payment, then opens the page it was for. */
export function BalePaymentStatus({ code, returnPath }: { code: string; returnPath: string }) {
  const router = useRouter();
  const [state, setState] = React.useState<"pending" | "expired" | "failed">("pending");

  React.useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const res = await fetch(`/api/payments/bale/status?code=${encodeURIComponent(code)}`, { cache: "no-store" });
        const data = (await res.json()) as { status?: string; returnPath?: string; result?: string };
        if (stop) return;
        if (data.status === "paid") return router.replace(`${data.returnPath ?? returnPath}?payment=${data.result ?? "paid"}`);
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
  }, [code, returnPath, router]);

  if (state === "expired") return <p role="status" className="text-sm font-medium text-destructive">مهلت این پرداخت تمام شده است. از سایت دوباره اقدام کنید.</p>;
  if (state === "failed") return <p role="status" className="text-sm font-medium text-destructive">پرداخت ناموفق بود. از سایت دوباره اقدام کنید.</p>;
  return (
    <p role="status" className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <Spinner className="size-4" /> در انتظار پرداخت در بله…
    </p>
  );
}
