"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { markEntryRefunded } from "@/features/tournaments/actions";

export function RefundButton({ entryId, label }: { entryId: string; label: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>بازپرداخت شد</Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="بازپرداخت انجام شد؟"
        description={`${label} — فقط وقتی بزنید که مبلغ را (مثلاً از کیف پول بله یا کارت‌به‌کارت) به بازیکن برگردانده‌اید. سایت خودش پولی برنمی‌گرداند.`}
        confirmLabel="ثبت بازپرداخت"
        onConfirm={async () => {
          const res = await markEntryRefunded(entryId);
          if (!res.ok) return void toast.error(res.error);
          toast.success(res.message);
          router.refresh();
        }}
      />
    </>
  );
}
