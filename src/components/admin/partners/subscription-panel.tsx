"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Gift, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { cancelSubscription, grantSubscription } from "@/features/subscriptions/admin-actions";
import { SUBSCRIPTION_PHASE_LABELS } from "@/features/subscriptions/constants";
import type { SubscriptionPhase } from "@/features/subscriptions/entitlement-rules";
import { formatDate } from "@/lib/format";

export interface SubscriptionRow {
  id: string;
  planName: string;
  phase: SubscriptionPhase;
  startsAt: string | null;
  endsAt: string | null;
  note: string | null;
}

const PHASE_BADGE: Record<SubscriptionPhase, "success" | "info" | "outline" | "destructive"> = {
  current: "success",
  scheduled: "info",
  expired: "outline",
  cancelled: "destructive",
  inactive: "outline",
};

/** Partner subscriptions on the admin detail page: list, manual (free) grant, cancel. */
export function SubscriptionPanel({ partnerId, approved, plans, rows }: { partnerId: string; approved: boolean; plans: { id: string; name: string; durationDays: number }[]; rows: SubscriptionRow[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [planId, setPlanId] = React.useState("");
  const [days, setDays] = React.useState("");
  const [note, setNote] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [cancelId, setCancelId] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await grantSubscription(partnerId, { planId, durationDays: days, note });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        return void toast.error(res.error);
      }
      toast.success(`${res.message} (${formatDate(new Date(res.data.startsAt))} تا ${formatDate(new Date(res.data.endsAt))})`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 text-sm">
      {rows.length === 0 ? <p className="text-muted-foreground">بدون اشتراک.</p> : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.id} className="space-y-1 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{r.planName}</span>
                <Badge variant={PHASE_BADGE[r.phase]}>{SUBSCRIPTION_PHASE_LABELS[r.phase]}</Badge>
              </div>
              {r.startsAt && r.endsAt ? <p className="text-xs text-muted-foreground">{formatDate(new Date(r.startsAt))} تا {formatDate(new Date(r.endsAt))}</p> : null}
              {r.note ? <p className="text-xs text-muted-foreground">{r.note}</p> : null}
              {r.phase === "current" || r.phase === "scheduled" ? (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={() => setCancelId(r.id)}><XCircle /> لغو</Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {approved ? (
        plans.length === 0 ? (
          <p className="text-xs text-muted-foreground">برای اعطای اشتراک، ابتدا در بخش «اشتراک‌ها» یک اشتراک تعریف کنید.</p>
        ) : (
          <Button variant="outline" size="sm" className="w-full" onClick={() => { setPlanId(plans[0].id); setDays(String(plans[0].durationDays)); setNote(""); setErrors({}); setOpen(true); }}>
            <Gift /> اعطای اشتراک رایگان
          </Button>
        )
      ) : (
        <p className="text-xs text-muted-foreground">اشتراک فقط به همکار تأییدشده داده می‌شود.</p>
      )}

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>اعطای اشتراک رایگان</DialogTitle>
            <DialogDescription>بدون پرداخت. اگر همکار اشتراک فعال داشته باشد، اشتراک جدید بعد از پایان آن شروع می‌شود.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="g-plan">اشتراک</Label>
              <NativeSelect id="g-plan" value={planId} onChange={(e) => { setPlanId(e.target.value); const p = plans.find((x) => x.id === e.target.value); if (p) setDays(String(p.durationDays)); }}>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </NativeSelect>
              {errors.planId ? <p role="alert" className="text-xs text-destructive">{errors.planId}</p> : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="g-days">مدت (روز)</Label>
              <Input id="g-days" dir="ltr" inputMode="numeric" className="text-start" value={days} onChange={(e) => setDays(e.target.value)} aria-invalid={!!errors.durationDays} />
              {errors.durationDays ? <p role="alert" className="text-xs text-destructive">{errors.durationDays}</p> : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="g-note">یادداشت (اختیاری)</Label>
              <Input id="g-note" maxLength={400} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلاً همکار قدیمی، دورهٔ آزمایشی" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>انصراف</Button>
              <Button type="submit" loading={pending}>اعطای اشتراک</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={cancelId !== null}
        onOpenChange={(o) => !o && setCancelId(null)}
        destructive
        title="لغو اشتراک؟"
        description="دسترسی همکار به امکانات این اشتراک همین حالا قطع می‌شود."
        confirmLabel="بله، لغو شود"
        onConfirm={async () => {
          if (!cancelId) return;
          const res = await cancelSubscription(cancelId);
          if (!res.ok) return void toast.error(res.error);
          toast.success(res.message);
          router.refresh();
        }}
      />
    </div>
  );
}
