"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { adjustStock } from "@/features/store/admin-actions";
import { formatNumber, toEnglishDigits } from "@/lib/format";

export function StockAdjustDialog({ productId, stock }: { productId: string; stock: number }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"add" | "remove">("add");
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState<"MANUAL" | "RETURN" | "CORRECTION">("MANUAL");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();

  const n = Number.parseInt(toEnglishDigits(amount), 10);
  const preview = Number.isFinite(n) ? stock + (mode === "add" ? n : -n) : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!Number.isFinite(n) || n <= 0) return setError("یک عدد مثبت وارد کنید.");
    setError(undefined);
    startTransition(async () => {
      const res = await adjustStock(productId, { delta: mode === "add" ? n : -n, reason, note });
      if (!res.ok) return setError(res.fieldErrors?.delta ?? res.error);
      toast.success(res.message);
      setOpen(false);
      setAmount("");
      setNote("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">تغییر موجودی</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تغییر موجودی</DialogTitle>
          <DialogDescription>موجودی فعلی: {formatNumber(stock)} عدد. هر تغییر در تاریخچه ثبت می‌شود.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={mode === "add" ? "default" : "outline"} onClick={() => setMode("add")}>
              افزایش
            </Button>
            <Button type="button" variant={mode === "remove" ? "destructive" : "outline"} onClick={() => setMode("remove")}>
              کاهش
            </Button>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="stock-amount">تعداد</Label>
            <Input id="stock-amount" inputMode="numeric" dir="ltr" className="text-start" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={!!error} autoFocus />
            {preview !== null ? <p className="text-xs text-muted-foreground">موجودی پس از تغییر: {formatNumber(preview)}</p> : null}
            {error ? <p role="alert" className="text-xs font-medium text-destructive">{error}</p> : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="stock-reason">دلیل</Label>
            <NativeSelect id="stock-reason" value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
              <option value="MANUAL">ورود/خروج دستی کالا</option>
              <option value="RETURN">مرجوعی</option>
              <option value="CORRECTION">اصلاح شمارش انبار</option>
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="stock-note">توضیح (اختیاری)</Label>
            <Input id="stock-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
          </div>
          <DialogFooter>
            <Button type="submit" loading={pending}>
              ثبت تغییر
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
