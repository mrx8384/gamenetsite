"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { reviewPartner } from "@/features/partners/admin-actions";
import type { PartnerStatusKey } from "@/features/partners/constants";

type Decision = "reject" | "suspend";

export function ReviewActions({ id, status, businessName }: { id: string; status: PartnerStatusKey; businessName: string }) {
  const router = useRouter();
  const [approveOpen, setApproveOpen] = React.useState(false);
  const [reasonFor, setReasonFor] = React.useState<Decision | null>(null);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submitReason(e: React.FormEvent) {
    e.preventDefault();
    if (!reasonFor) return;
    startTransition(async () => {
      const res = await reviewPartner(id, reasonFor, reason);
      if (!res.ok) {
        setError(res.fieldErrors?.reason ?? res.error);
        return void toast.error(res.error);
      }
      toast.success(res.message);
      setReasonFor(null);
      router.refresh();
    });
  }

  const canApprove = status !== "APPROVED";
  return (
    <div className="flex flex-wrap gap-2">
      {canApprove ? (
        <Button onClick={() => setApproveOpen(true)}><CheckCircle2 /> {status === "SUSPENDED" ? "فعال‌سازی دوباره" : "تأیید همکار"}</Button>
      ) : null}
      {status === "PENDING" ? (
        <Button variant="outline" className="text-destructive" onClick={() => { setReason(""); setError(null); setReasonFor("reject"); }}><XCircle /> رد درخواست</Button>
      ) : null}
      {status === "APPROVED" ? (
        <Button variant="outline" className="text-destructive" onClick={() => { setReason(""); setError(null); setReasonFor("suspend"); }}><Ban /> تعلیق همکار</Button>
      ) : null}

      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title={`تأیید «${businessName}»؟`}
        description="نقش این کاربر «همکار» می‌شود و به پنل همکار دسترسی پیدا می‌کند."
        confirmLabel="بله، تأیید شود"
        onConfirm={async () => {
          const res = await reviewPartner(id, "approve");
          if (!res.ok) return void toast.error(res.error);
          toast.success(res.message);
          router.refresh();
        }}
      />

      <Dialog open={reasonFor !== null} onOpenChange={(o) => !o && !pending && setReasonFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{reasonFor === "reject" ? "رد درخواست همکاری" : "تعلیق همکار"}</DialogTitle>
            <DialogDescription>این دلیل در پنل همکار به کاربر نمایش داده می‌شود.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitReason} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="review-reason">دلیل</Label>
              <Textarea id="review-reason" rows={4} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={!!error} aria-describedby={error ? "review-reason-error" : undefined} />
              {error ? <p id="review-reason-error" role="alert" className="text-xs font-medium text-destructive">{error}</p> : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={pending} onClick={() => setReasonFor(null)}>انصراف</Button>
              <Button type="submit" variant="destructive" loading={pending}>{reasonFor === "reject" ? "رد درخواست" : "تعلیق"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
