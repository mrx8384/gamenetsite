"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Building2, ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/states";
import { Textarea } from "@/components/ui/textarea";
import { uploadImages } from "@/features/media/actions";
import { deleteOrganization, moveOrganization, saveOrganization } from "@/features/organizations/actions";
import { mediaUrl } from "@/lib/media";

export interface AdminOrganization {
  id: string;
  name: string;
  logo: { id: string; storageKey: string } | null;
  description: string;
  terms: string;
  website: string;
  showDetails: boolean;
  isActive: boolean;
}

type Form = Omit<AdminOrganization, "id">;
const empty: Form = { name: "", logo: null, description: "", terms: "", website: "", showDetails: false, isActive: true };

function LogoPicker({ value, onChange }: { value: Form["logo"]; onChange: (v: Form["logo"]) => void }) {
  const ref = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  async function upload(file: File) {
    if (file.size > 5 * 1024 * 1024) return void toast.error("حجم تصویر باید حداکثر ۵ مگابایت باشد.");
    setBusy(true);
    const fd = new FormData();
    fd.set("folder", "organizations");
    fd.append("files", file);
    const res = await uploadImages(fd);
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    onChange(res.data[0]);
  }
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white">
        {value ? <Image src={mediaUrl(value.storageKey)} alt="لوگوی سازمان" fill unoptimized sizes="80px" className="object-contain p-1.5" /> : <Building2 className="size-7 text-muted-foreground" aria-hidden />}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" loading={busy} onClick={() => ref.current?.click()}>
          <ImagePlus /> {value ? "تغییر لوگو" : "انتخاب لوگو"}
        </Button>
        {value ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <Trash2 className="text-destructive" /> حذف
          </Button>
        ) : null}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function OrganizationDialog({ org, open, onOpenChange }: { org: AdminOrganization | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [v, setV] = React.useState<Form>(org ?? empty);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();
  const err = (k: string) => (errors[k] ? <p role="alert" className="text-xs font-medium text-destructive">{errors[k]}</p> : null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveOrganization(org?.id ?? null, {
        name: v.name,
        logoId: v.logo?.id ?? "",
        description: v.description,
        terms: v.terms,
        website: v.website,
        showDetails: v.showDetails,
        isActive: v.isActive,
      });
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
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{org ? "ویرایش سازمان" : "سازمان جدید"}</DialogTitle>
          <DialogDescription>لوگو و نام در ردیف «سازمان‌های طرف قرارداد» صفحهٔ اصلی نمایش داده می‌شود.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>لوگو</Label>
            <LogoPicker value={v.logo} onChange={(logo) => setV({ ...v, logo })} />
            <p className="text-xs text-muted-foreground">بهتر است PNG با پس‌زمینهٔ شفاف یا سفید باشد.</p>
            {err("logoId")}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="org-name">نام سازمان</Label>
            <Input id="org-name" value={v.name} maxLength={120} onChange={(e) => setV({ ...v, name: e.target.value })} aria-invalid={!!errors.name} />
            {err("name")}
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={v.showDetails} onChange={(e) => setV({ ...v, showDetails: e.target.checked })} className="mt-1 size-4 accent-[var(--brand-green-dark)]" />
            <span>
              صفحهٔ جزئیات داشته باشد
              <span className="block text-xs text-muted-foreground">با زدن روی این سازمان، پنجره‌ای با توضیحات و شرایط قرارداد باز می‌شود.</span>
            </span>
          </label>
          {v.showDetails ? (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="org-desc">توضیحات</Label>
                <Textarea id="org-desc" value={v.description} maxLength={3000} rows={4} onChange={(e) => setV({ ...v, description: e.target.value })} aria-invalid={!!errors.description} />
                {err("description")}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="org-terms">شرایط قرارداد</Label>
                <Textarea id="org-terms" value={v.terms} maxLength={5000} rows={6} onChange={(e) => setV({ ...v, terms: e.target.value })} placeholder={"هر بند در یک خط، مثلاً:\n۲۰٪ تخفیف ساعت بازی برای کارکنان\nارائهٔ کارت سازمانی الزامی است"} aria-invalid={!!errors.terms} />
                {err("terms")}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="org-web">سایت سازمان (اختیاری)</Label>
                <Input id="org-web" dir="ltr" className="text-start" value={v.website} maxLength={300} onChange={(e) => setV({ ...v, website: e.target.value })} placeholder="https://" aria-invalid={!!errors.website} />
                {err("website")}
              </div>
            </>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.isActive} onChange={(e) => setV({ ...v, isActive: e.target.checked })} className="size-4 accent-[var(--brand-green-dark)]" /> نمایش در سایت
          </label>
          <DialogFooter>
            <Button type="submit" loading={pending}>{org ? "ذخیرهٔ تغییرات" : "افزودن سازمان"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function OrganizationsManager({ organizations }: { organizations: AdminOrganization[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<AdminOrganization | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<AdminOrganization | null>(null);
  const [pending, startTransition] = React.useTransition();
  const fa = (n: number) => n.toLocaleString("fa-IR");

  const openDialog = (o: AdminOrganization | null) => {
    setEditing(o);
    setDialogOpen(true);
  };
  const move = (id: string, dir: "up" | "down") =>
    startTransition(async () => {
      const res = await moveOrganization(id, dir);
      if (!res.ok) toast.error(res.error);
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">ترتیب این فهرست، ترتیب نمایش در سایت است. وقتی سازمانی نباشد، این بخش در صفحهٔ اصلی دیده نمی‌شود.</p>
        <Button onClick={() => openDialog(null)}><Plus /> سازمان جدید</Button>
      </div>
      {organizations.length === 0 ? (
        <EmptyState icon={Building2} title="هنوز سازمانی اضافه نشده" description="لوگو و نام سازمان‌هایی که با آن‌ها قرارداد دارید را اضافه کنید." />
      ) : (
        <ol className="divide-y rounded-xl border bg-surface">
          {organizations.map((o, i) => (
            <li key={o.id} className="flex flex-wrap items-center gap-3 p-3">
              <span className="w-6 text-sm text-muted-foreground">{fa(i + 1)}</span>
              <div className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white">
                {o.logo ? <Image src={mediaUrl(o.logo.storageKey)} alt="" fill unoptimized sizes="48px" className="object-contain p-1" /> : <Building2 className="size-5 text-muted-foreground" aria-hidden />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{o.name}</p>
                <p className="flex flex-wrap gap-1 pt-0.5">
                  {o.isActive ? null : <Badge variant="secondary">پنهان</Badge>}
                  {o.showDetails ? <Badge variant="outline">صفحهٔ جزئیات</Badge> : null}
                </p>
              </div>
              <div className="flex">
                <Button variant="ghost" size="icon-sm" aria-label={`جابه‌جایی «${o.name}» به قبل`} disabled={pending || i === 0} onClick={() => move(o.id, "up")}><ArrowUp /></Button>
                <Button variant="ghost" size="icon-sm" aria-label={`جابه‌جایی «${o.name}» به بعد`} disabled={pending || i === organizations.length - 1} onClick={() => move(o.id, "down")}><ArrowDown /></Button>
                <Button variant="ghost" size="icon-sm" aria-label={`ویرایش «${o.name}»`} onClick={() => openDialog(o)}><Pencil /></Button>
                <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label={`حذف «${o.name}»`} onClick={() => setToDelete(o)}><Trash2 /></Button>
              </div>
            </li>
          ))}
        </ol>
      )}
      {dialogOpen ? <OrganizationDialog key={editing?.id ?? "new"} org={editing} open={dialogOpen} onOpenChange={setDialogOpen} /> : null}
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        destructive
        title="حذف سازمان؟"
        description={toDelete ? `«${toDelete.name}» و لوگوی آن حذف می‌شود.` : undefined}
        confirmLabel="حذف"
        onConfirm={async () => {
          if (!toDelete) return;
          const res = await deleteOrganization(toDelete.id);
          if (!res.ok) return void toast.error(res.error);
          toast.success(res.message);
          router.refresh();
        }}
      />
    </div>
  );
}
