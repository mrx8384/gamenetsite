"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addCatalogCategory, deleteCatalogCategory, moveCatalogCategory, renameCatalogCategory } from "@/features/game-catalog/admin-actions";
import type { AdminCatalogCategory } from "@/features/game-catalog/admin-queries";
import { CATEGORY_MAX, type Platform } from "@/features/game-catalog/constants";
import type { ActionResult } from "@/lib/action-result";
import { formatNumber } from "@/lib/format";

/** Categories of one platform: add, rename (merges on conflict), delete (games → «بدون دسته»), reorder. */
export function CategoryManager({ platform, categories }: { platform: Platform; categories: AdminCatalogCategory[] }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [renaming, setRenaming] = React.useState<AdminCatalogCategory | null>(null);
  const [deleting, setDeleting] = React.useState<AdminCatalogCategory | null>(null);
  const movable = categories.filter((c) => !c.isDefault);

  function run(fn: () => Promise<ActionResult<undefined>>, after?: () => void) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      if (res.message) toast.success(res.message);
      after?.();
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>دسته‌بندی‌های <span className="ltr">{platform}</span></CardTitle>
        <CardDescription>ترتیب دسته‌ها همان ترتیب نمایش در کاتالوگ است.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => addCatalogCategory(platform, name), () => setName(""));
          }}
        >
          <Input aria-label="نام دستهٔ جدید" value={name} maxLength={CATEGORY_MAX} onChange={(e) => setName(e.target.value)} placeholder="دستهٔ جدید" />
          <Button type="submit" variant="strong" disabled={!name.trim() || pending}><Plus /> افزودن</Button>
        </form>
        <ul className="divide-y rounded-xl border">
          {categories.map((c) => {
            const i = movable.findIndex((m) => m.id === c.id);
            return (
              <li key={c.id} className="flex items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                    {c.isDefault ? <Lock className="size-3.5 text-muted-foreground" aria-label="قفل" /> : null}
                    {c.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatNumber(c.gameCount)} بازی</p>
                </div>
                {c.isDefault ? null : (
                  <div className="flex items-center">
                    <Button variant="ghost" size="icon-sm" aria-label={`بالا بردن ${c.name}`} disabled={pending || i === 0} onClick={() => run(() => moveCatalogCategory(c.id, "up"))}><ChevronUp /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`پایین بردن ${c.name}`} disabled={pending || i === movable.length - 1} onClick={() => run(() => moveCatalogCategory(c.id, "down"))}><ChevronDown /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`تغییر نام ${c.name}`} onClick={() => setRenaming(c)}><Pencil /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`حذف ${c.name}`} className="text-destructive" onClick={() => setDeleting(c)}><Trash2 /></Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>

      <RenameDialog key={renaming?.id ?? "closed"} category={renaming} onClose={() => setRenaming(null)} onSave={(id, newName) => run(() => renameCatalogCategory(id, newName), () => setRenaming(null))} pending={pending} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        destructive
        title={`حذف دستهٔ «${deleting?.name ?? ""}»؟`}
        description={deleting?.gameCount ? `${formatNumber(deleting.gameCount)} بازی این دسته حذف نمی‌شوند و به «بدون دسته» منتقل می‌شوند.` : "این دسته بازی‌ای ندارد."}
        confirmLabel="حذف دسته"
        onConfirm={async () => {
          if (!deleting) return;
          const res = await deleteCatalogCategory(deleting.id);
          if (!res.ok) return void toast.error(res.error);
          toast.success(res.message);
          router.refresh();
        }}
      />
    </Card>
  );
}

function RenameDialog({ category, onClose, onSave, pending }: { category: AdminCatalogCategory | null; onClose: () => void; onSave: (id: number, name: string) => void; pending: boolean }) {
  const [value, setValue] = React.useState(category?.name ?? "");
  return (
    <Dialog open={category !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>تغییر نام دسته</DialogTitle>
          <DialogDescription>اگر نام جدید از قبل وجود داشته باشد، دو دسته با هم ادغام می‌شوند.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (category) onSave(category.id, value);
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="rename-cat">نام جدید</Label>
            <Input id="rename-cat" value={value} maxLength={CATEGORY_MAX} onChange={(e) => setValue(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>انصراف</Button>
            <Button type="submit" loading={pending} disabled={!value.trim()}>ذخیره</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
