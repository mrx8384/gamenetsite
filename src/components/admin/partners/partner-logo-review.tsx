"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Building2, Check, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { removePartnerLogo, reviewPartnerLogo } from "@/features/partners/logo-actions";

function Box({ url, label }: { url: string | null; label: string }) {
  return (
    <figure className="space-y-1 text-center">
      <span className="relative flex size-24 items-center justify-center overflow-hidden rounded-xl border bg-white">
        {url ? <Image src={url} alt={label} fill sizes="96px" unoptimized className="object-contain p-1.5" /> : <Building2 className="size-8 text-muted-foreground" aria-hidden />}
      </span>
      <figcaption className="text-xs text-muted-foreground">{label}</figcaption>
    </figure>
  );
}

/** Admin: approve/reject the partner's submitted logo, or remove the approved one. */
export function PartnerLogoReview({ partnerId, logoUrl, pendingUrl }: { partnerId: string; logoUrl: string | null; pendingUrl: string | null }) {
  const router = useRouter();
  const [reason, setReason] = React.useState("");
  const [confirmRemove, setConfirmRemove] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      setReason("");
      router.refresh();
    });

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap gap-4">
        <Box url={logoUrl} label={logoUrl ? "لوگوی فعلی" : "بدون لوگو"} />
        {pendingUrl ? <Box url={pendingUrl} label="ارسال‌شده — در انتظار تأیید" /> : null}
      </div>
      {pendingUrl ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" loading={pending} onClick={() => run(() => reviewPartnerLogo(partnerId, "approve", ""))}><Check /> تأیید و جایگزینی</Button>
          </div>
          <Label htmlFor="logo-reason">رد با دلیل</Label>
          <div className="flex flex-wrap gap-2">
            <Input id="logo-reason" className="min-w-0 flex-1" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="مثلاً کیفیت پایین است" />
            <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => reviewPartnerLogo(partnerId, "reject", reason))}><X /> رد</Button>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground">لوگوی جدیدی برای بررسی نیست. همکار از پنل خودش لوگو می‌فرستد.</p>
      )}
      {logoUrl ? (
        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmRemove(true)}><Trash2 /> حذف لوگوی فعلی</Button>
      ) : null}
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        destructive
        title="حذف لوگوی همکار؟"
        description="به جای لوگو، نام همکار در پنلش نمایش داده می‌شود."
        confirmLabel="حذف"
        onConfirm={() => run(() => removePartnerLogo(partnerId))}
      />
    </div>
  );
}
