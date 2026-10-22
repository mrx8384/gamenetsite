"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { changeOrderStatus, saveAdminNote } from "@/features/orders/admin-actions";
import { ORDER_STATUS_LABEL, type OrderStatusKey } from "@/features/orders/schemas";

export function OrderAdminPanel({ orderId, transitions, adminNote }: { orderId: string; transitions: OrderStatusKey[]; adminNote: string }) {
  const router = useRouter();
  const [target, setTarget] = React.useState<OrderStatusKey | null>(null);
  const [note, setNote] = React.useState("");
  const [memo, setMemo] = React.useState(adminNote);
  const [saving, startSaving] = React.useTransition();

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">مدیریت سفارش</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        {transitions.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">تغییر وضعیت به:</p>
            <div className="flex flex-wrap gap-2">
              {transitions.map((t) => (
                <Button key={t} variant={t === "CANCELLED" || t === "REFUNDED" ? "outline" : "default"} size="sm" onClick={() => { setNote(""); setTarget(t); }}>
                  {ORDER_STATUS_LABEL[t]}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">تغییر وضعیت دیگری برای این سفارش ممکن نیست.</p>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="admin-note">یادداشت داخلی (فقط مدیران)</Label>
          <Textarea id="admin-note" rows={3} value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={2000} />
          <Button
            variant="outline"
            size="sm"
            className="justify-self-start"
            loading={saving}
            onClick={() => startSaving(async () => {
              const res = await saveAdminNote(orderId, memo);
              if (res.ok) toast.success(res.message);
              else toast.error(res.error);
            })}
          >
            ذخیرهٔ یادداشت
          </Button>
        </div>
      </CardContent>
      {target ? (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setTarget(null)}
          destructive={target === "CANCELLED"}
          title={`تغییر وضعیت به «${ORDER_STATUS_LABEL[target]}»؟`}
          description={
            <span className="grid gap-2">
              {target === "CANCELLED" ? "موجودی کالاهای این سفارش به انبار برمی‌گردد. اگر مبلغی پرداخت شده، بازپرداخت را جداگانه انجام دهید." : "این تغییر در تاریخچهٔ سفارش ثبت می‌شود."}
              <Input placeholder="توضیح (اختیاری) — مثلاً کد رهگیری پست" value={note} onChange={(e) => setNote(e.target.value)} aria-label="توضیح" />
            </span>
          }
          confirmLabel="تأیید"
          onConfirm={async () => {
            const res = await changeOrderStatus(orderId, { to: target, note });
            if (res.ok) toast.success(res.message);
            else toast.error(res.error);
            router.refresh();
          }}
        />
      ) : null}
    </Card>
  );
}
