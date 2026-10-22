"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cancelMyOrder, retryPayment } from "@/features/orders/actions";

export function CustomerOrderActions({ orderNumber }: { orderNumber: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [confirm, setConfirm] = React.useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await retryPayment(orderNumber);
            if (!res.ok) {
              toast.error(res.error);
              return router.refresh();
            }
            window.location.assign(res.data.redirectTo);
          })
        }
      >
        پرداخت سفارش
      </Button>
      <Button variant="outline" onClick={() => setConfirm(true)}>لغو سفارش</Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        destructive
        title="لغو این سفارش؟"
        description="کالاهای رزروشده آزاد می‌شوند."
        confirmLabel="بله، لغو شود"
        onConfirm={async () => {
          const res = await cancelMyOrder(orderNumber);
          if (res.ok) toast.success(res.message);
          else toast.error(res.error);
          router.refresh();
        }}
      />
    </div>
  );
}
