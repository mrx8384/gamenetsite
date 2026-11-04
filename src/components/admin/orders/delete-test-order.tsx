"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteTestOrder } from "@/features/orders/admin-actions";

/** Only rendered for orders placed with test payment credentials. */
export function DeleteTestOrder({ orderId, number }: { orderId: string; number: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  return (
    <Card className="border-destructive/40">
      <CardHeader><CardTitle className="text-base">سفارش آزمایشی</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">این سفارش با درگاه آزمایشی ثبت شده و پولی جابه‌جا نشده است. با حذف، موجودی کالاها برمی‌گردد و سفارش و پرداخت‌هایش پاک می‌شوند.</p>
        <Button variant="destructive" size="sm" onClick={() => setOpen(true)}><Trash2 /> حذف سفارش آزمایشی</Button>
      </CardContent>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        destructive
        title="حذف سفارش آزمایشی؟"
        description={`سفارش ${number} برای همیشه حذف می‌شود.`}
        confirmLabel="حذف"
        onConfirm={async () => {
          const res = await deleteTestOrder(orderId);
          if (!res.ok) return void toast.error(res.error);
          toast.success(res.message);
          router.push("/admin/orders");
          router.refresh();
        }}
      />
    </Card>
  );
}
