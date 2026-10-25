"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/states";
import { Textarea } from "@/components/ui/textarea";
import { deleteFaq, moveFaq, saveFaq } from "@/features/support/faq-actions";
import { indexFaqs, matchFaqs } from "@/features/support/faq-match";

export interface AdminFaq {
  id: string;
  question: string;
  answer: string;
  keywords: string;
  isActive: boolean;
  openCount: number;
  helpfulCount: number;
}

type FormData = { question: string; answer: string; keywords: string; isActive: boolean };
const empty: FormData = { question: "", answer: "", keywords: "", isActive: true };
const fa = (n: number) => n.toLocaleString("fa-IR");

function FaqDialog({ faq, open, onOpenChange }: { faq: AdminFaq | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [v, setV] = React.useState<FormData>(faq ?? empty);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();
  const err = (k: string) => (errors[k] ? <p role="alert" className="text-xs font-medium text-destructive">{errors[k]}</p> : null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveFaq(faq?.id ?? null, v);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        return void toast.error(res.error);
      }
      toast.success(res.message);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{faq ? "ویرایش سؤال" : "سؤال جدید"}</DialogTitle>
          <DialogDescription>وقتی کاربر در چت سؤالی شبیه این بنویسد، این جواب به او پیشنهاد می‌شود.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="faq-q">سؤال</Label>
            <Input id="faq-q" value={v.question} maxLength={200} onChange={(e) => setV({ ...v, question: e.target.value })} aria-invalid={!!errors.question} />
            {err("question")}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="faq-a">جواب</Label>
            <Textarea id="faq-a" value={v.answer} maxLength={2000} rows={5} onChange={(e) => setV({ ...v, answer: e.target.value })} aria-invalid={!!errors.answer} />
            {err("answer")}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="faq-k">کلمات کلیدی (اختیاری)</Label>
            <Input id="faq-k" value={v.keywords} maxLength={300} onChange={(e) => setV({ ...v, keywords: e.target.value })} placeholder="مثلاً: ارسال پست تیپاکس تحویل" aria-describedby="faq-k-hint" />
            <p id="faq-k-hint" className="text-xs text-muted-foreground">کلمه‌های دیگری که مشتری‌ها ممکن است برای همین سؤال بنویسند، با فاصله.</p>
            {err("keywords")}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.isActive} onChange={(e) => setV({ ...v, isActive: e.target.checked })} className="size-4 accent-[var(--brand-green-dark)]" /> فعال (به کاربران پیشنهاد شود)
          </label>
          <DialogFooter>
            <Button type="submit" loading={pending}>{faq ? "ذخیرهٔ تغییرات" : "افزودن سؤال"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Lets staff type a question and see which answers customers would be offered. */
function MatchTester({ faqs }: { faqs: AdminFaq[] }) {
  const [q, setQ] = React.useState("");
  const index = React.useMemo(() => indexFaqs(faqs.filter((f) => f.isActive)), [faqs]);
  const results = q.trim().length >= 3 ? matchFaqs(index, q) : [];
  return (
    <div className="space-y-2 rounded-xl border bg-surface p-4">
      <Label htmlFor="faq-test" className="flex items-center gap-2"><Search className="size-4" /> امتحان پیشنهادها</Label>
      <Input id="faq-test" value={q} onChange={(e) => setQ(e.target.value)} placeholder="یک سؤال مثل مشتری بنویسید…" />
      {q.trim().length >= 3 ? (
        results.length ? (
          <ol className="list-inside list-decimal space-y-1 text-sm">{results.map((r) => <li key={r.id}>{r.question}</li>)}</ol>
        ) : (
          <p className="text-sm text-muted-foreground">جوابی پیدا نشد؛ این پیام به پشتیبان می‌رسد. برای پوشش آن، سؤال یا کلمات کلیدی اضافه کنید.</p>
        )
      ) : null}
    </div>
  );
}

export function FaqManager({ faqs }: { faqs: AdminFaq[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<AdminFaq | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<AdminFaq | null>(null);
  const [pending, startTransition] = React.useTransition();

  const openDialog = (f: AdminFaq | null) => {
    setEditing(f);
    setDialogOpen(true);
  };
  const move = (id: string, dir: "up" | "down") =>
    startTransition(async () => {
      const res = await moveFaq(id, dir);
      if (!res.ok) toast.error(res.error);
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">۴ سؤال اول، به‌عنوان «سؤالات متداول» بالای پنجرهٔ چت هم نمایش داده می‌شوند.</p>
        <Button onClick={() => openDialog(null)}><Plus /> سؤال جدید</Button>
      </div>
      <MatchTester faqs={faqs} />
      {faqs.length === 0 ? (
        <EmptyState icon={Search} title="هنوز سؤالی اضافه نشده" description="سؤال‌های پرتکرار مشتری‌ها را با جوابشان اضافه کنید." />
      ) : (
        <ol className="divide-y rounded-xl border bg-surface">
          {faqs.map((f, i) => (
            <li key={f.id} className="flex flex-wrap items-start gap-3 p-4">
              <span className="w-6 pt-0.5 text-sm text-muted-foreground">{fa(i + 1)}</span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-medium">
                  {f.question} {f.isActive ? null : <Badge variant="secondary">غیرفعال</Badge>}
                </p>
                <p className="line-clamp-2 text-sm text-muted-foreground">{f.answer}</p>
                <p className="text-xs text-muted-foreground">باز شده: {fa(f.openCount)} · «مشکلم حل شد»: {fa(f.helpfulCount)}</p>
              </div>
              <div className="flex">
                <Button variant="ghost" size="icon-sm" aria-label={`بالا بردن «${f.question}»`} disabled={pending || i === 0} onClick={() => move(f.id, "up")}><ArrowUp /></Button>
                <Button variant="ghost" size="icon-sm" aria-label={`پایین بردن «${f.question}»`} disabled={pending || i === faqs.length - 1} onClick={() => move(f.id, "down")}><ArrowDown /></Button>
                <Button variant="ghost" size="icon-sm" aria-label={`ویرایش «${f.question}»`} onClick={() => openDialog(f)}><Pencil /></Button>
                <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label={`حذف «${f.question}»`} onClick={() => setToDelete(f)}><Trash2 /></Button>
              </div>
            </li>
          ))}
        </ol>
      )}
      {dialogOpen ? <FaqDialog key={editing?.id ?? "new"} faq={editing} open={dialogOpen} onOpenChange={setDialogOpen} /> : null}
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        destructive
        title="حذف سؤال؟"
        description={toDelete ? `«${toDelete.question}» برای همیشه حذف می‌شود.` : undefined}
        confirmLabel="حذف"
        onConfirm={async () => {
          if (!toDelete) return;
          const res = await deleteFaq(toDelete.id);
          if (!res.ok) return void toast.error(res.error);
          toast.success(res.message);
          router.refresh();
        }}
      />
    </div>
  );
}
