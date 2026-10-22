"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveNewsCategory } from "@/features/news/admin-actions";
import { slugify } from "@/lib/text";

export function NewsCategoryDialog({ category, trigger }: { category?: { id: string; name: string; slug: string; sortOrder: number }; trigger: React.ReactNode }) {
  const router = useRouter();
  const blank = { name: "", slug: "", sortOrder: 0 };
  const [open, setOpen] = React.useState(false);
  const [v, setV] = React.useState(category ?? blank);
  const [touched, setTouched] = React.useState(!!category);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setV(category ?? blank); setErrors({}); setTouched(!!category); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{category ? "ویرایش دستهٔ اخبار" : "دستهٔ جدید اخبار"}</DialogTitle></DialogHeader>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const res = await saveNewsCategory(category?.id ?? null, v);
              if (!res.ok) { setErrors(res.fieldErrors ?? {}); return void toast.error(res.error); }
              toast.success(res.message);
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="nc-name">نام دسته</Label>
            <Input id="nc-name" value={v.name} aria-invalid={!!errors.name} onChange={(e) => setV({ ...v, name: e.target.value, slug: touched ? v.slug : slugify(e.target.value) })} />
            {errors.name ? <p className="text-xs text-destructive">{errors.name}</p> : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nc-slug">نامک</Label>
            <Input id="nc-slug" value={v.slug} aria-invalid={!!errors.slug} onChange={(e) => { setTouched(true); setV({ ...v, slug: e.target.value }); }} />
            {errors.slug ? <p className="text-xs text-destructive">{errors.slug}</p> : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nc-sort">ترتیب نمایش</Label>
            <Input id="nc-sort" type="number" min={0} dir="ltr" className="text-start" value={v.sortOrder} onChange={(e) => setV({ ...v, sortOrder: Number(e.target.value) || 0 })} />
          </div>
          <DialogFooter><Button type="submit" loading={pending}>ذخیره</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
