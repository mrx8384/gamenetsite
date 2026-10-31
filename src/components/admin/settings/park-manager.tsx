"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ImageIcon, ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
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
import { deleteAttraction, moveAttraction, saveAttraction } from "@/features/park/actions";
import { mediaUrl } from "@/lib/media";

export interface AdminAttraction {
  id: string;
  title: string;
  description: string;
  upload: { id: string; storageKey: string } | null;
  /** Built-in photo from the 3D world (already validated on the server). */
  staticImage: string | null;
  isActive: boolean;
}

type Form = Omit<AdminAttraction, "id">;
const empty: Form = { title: "", description: "", upload: null, staticImage: null, isActive: true };
const previewOf = (v: Pick<Form, "upload" | "staticImage">) => (v.upload ? mediaUrl(v.upload.storageKey) : v.staticImage);

function AttractionDialog({ item, open, onOpenChange }: { item: AdminAttraction | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [v, setV] = React.useState<Form>(item ?? empty);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const err = (k: string) => (errors[k] ? <p role="alert" className="text-xs font-medium text-destructive">{errors[k]}</p> : null);
  const preview = previewOf(v);

  async function upload(file: File) {
    if (file.size > 5 * 1024 * 1024) return void toast.error("حجم تصویر باید حداکثر ۵ مگابایت باشد.");
    setBusy(true);
    const fd = new FormData();
    fd.set("folder", "park");
    fd.append("files", file);
    const res = await uploadImages(fd);
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    setV((s) => ({ ...s, upload: res.data[0] }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveAttraction(item?.id ?? null, {
        title: v.title,
        description: v.description,
        imageId: v.upload?.id ?? "",
        keepStaticImage: v.staticImage !== null,
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
          <DialogTitle>{item ? "ویرایش بخش" : "بخش جدید"}</DialogTitle>
          <DialogDescription>هر بخش در صفحهٔ «شهربازی اتم گیم» با عکس، عنوان و توضیح نمایش داده می‌شود.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <div className="grid gap-2">
            <Label>عکس</Label>
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl border bg-secondary">
              {preview ? (
                <Image src={preview} alt="عکس این بخش" fill unoptimized sizes="420px" className="object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center text-sm text-muted-foreground">بدون عکس</div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" loading={busy} onClick={() => fileRef.current?.click()}>
                <ImagePlus /> {preview ? "تغییر عکس" : "انتخاب عکس"}
              </Button>
              {preview ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setV({ ...v, upload: null, staticImage: null })}>
                  <Trash2 className="text-destructive" /> حذف عکس
                </Button>
              ) : null}
            </div>
            <input
              ref={fileRef}
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
          <div className="grid gap-1.5">
            <Label htmlFor="park-title">عنوان</Label>
            <Input id="park-title" value={v.title} maxLength={120} onChange={(e) => setV({ ...v, title: e.target.value })} aria-invalid={!!errors.title} />
            {err("title")}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="park-desc">توضیح</Label>
            <Textarea id="park-desc" value={v.description} maxLength={2000} rows={6} onChange={(e) => setV({ ...v, description: e.target.value })} aria-invalid={!!errors.description} />
            {err("description")}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.isActive} onChange={(e) => setV({ ...v, isActive: e.target.checked })} className="size-4 accent-[var(--brand-green-dark)]" /> نمایش در سایت
          </label>
          <DialogFooter>
            <Button type="submit" loading={pending}>{item ? "ذخیرهٔ تغییرات" : "افزودن بخش"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ParkManager({ items }: { items: AdminAttraction[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<AdminAttraction | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<AdminAttraction | null>(null);
  const [pending, startTransition] = React.useTransition();
  const fa = (n: number) => n.toLocaleString("fa-IR");

  const openDialog = (a: AdminAttraction | null) => {
    setEditing(a);
    setDialogOpen(true);
  };
  const move = (id: string, dir: "up" | "down") =>
    startTransition(async () => {
      const res = await moveAttraction(id, dir);
      if (!res.ok) toast.error(res.error);
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">ترتیب این فهرست، ترتیب نمایش در صفحه است. عکس‌های اولیه از دنیای سه‌بعدی اتم آمده‌اند.</p>
        <Button onClick={() => openDialog(null)}><Plus /> بخش جدید</Button>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={ImageIcon} title="هنوز بخشی اضافه نشده" description="بازی‌ها و بخش‌های مجموعه را با عکس و توضیح اضافه کنید." />
      ) : (
        <ol className="divide-y rounded-xl border bg-surface">
          {items.map((a, i) => {
            const preview = previewOf(a);
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-3 p-3">
                <span className="w-6 text-sm text-muted-foreground">{fa(i + 1)}</span>
                <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg border bg-secondary">
                  {preview ? <Image src={preview} alt="" fill unoptimized sizes="64px" className="object-cover" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.title}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{a.description}</p>
                  {a.isActive ? null : <Badge variant="secondary" className="mt-1">پنهان</Badge>}
                </div>
                <div className="flex">
                  <Button variant="ghost" size="icon-sm" aria-label={`جابه‌جایی «${a.title}» به بالا`} disabled={pending || i === 0} onClick={() => move(a.id, "up")}><ArrowUp /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`جابه‌جایی «${a.title}» به پایین`} disabled={pending || i === items.length - 1} onClick={() => move(a.id, "down")}><ArrowDown /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`ویرایش «${a.title}»`} onClick={() => openDialog(a)}><Pencil /></Button>
                  <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label={`حذف «${a.title}»`} onClick={() => setToDelete(a)}><Trash2 /></Button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {dialogOpen ? <AttractionDialog key={editing?.id ?? "new"} item={editing} open={dialogOpen} onOpenChange={setDialogOpen} /> : null}
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        destructive
        title="حذف بخش؟"
        description={toDelete ? `«${toDelete.title}» از صفحهٔ شهربازی حذف می‌شود.` : undefined}
        confirmLabel="حذف"
        onConfirm={async () => {
          if (!toDelete) return;
          const res = await deleteAttraction(toDelete.id);
          if (!res.ok) return void toast.error(res.error);
          toast.success(res.message);
          router.refresh();
        }}
      />
    </div>
  );
}
