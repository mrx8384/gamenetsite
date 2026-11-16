"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { cancelMyBooking } from "@/features/booking/actions";

export function CancelBookingButton({ code }: { code: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>لغو رزرو</Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="رزرو لغو شود؟"
        description="شیفت برای دیگران آزاد می‌شود."
        confirmLabel="بله، لغو کن"
        destructive
        onConfirm={async () => {
          const res = await cancelMyBooking(code);
          if (!res.ok) return void toast.error(res.error);
          toast.success(res.message);
          setOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}
