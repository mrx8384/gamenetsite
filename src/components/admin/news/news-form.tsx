"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { saveNewsPost } from "@/features/news/admin-actions";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { slugify } from "@/lib/text";
import { CoverPicker } from "./cover-picker";

export interface NewsFormInitial {
  title: string;
  slug: string;
  excerpt: string;
  categoryId: string;
  cover: { id: string; storageKey: string } | null;
  status: "DRAFT" | "PUBLISHED";
  isFeatured: boolean;
  content: JSONContent | null;
}

export function NewsForm({ postId, initial, categories }: { postId?: string; initial: NewsFormInitial; categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const [v, setV] = React.useState(initial);
  const [slugTouched, setSlugTouched] = React.useState(!!postId);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();
  const hydrated = useHydrated();
  const err = (k: string) => (errors[k] ? <p role="alert" className="text-xs font-medium text-destructive">{errors[k]}</p> : null);

  function save(status: "DRAFT" | "PUBLISHED") {
    startTransition(async () => {
      const res = await saveNewsPost(postId ?? null, {
        title: v.title, slug: v.slug, excerpt: v.excerpt, categoryId: v.categoryId, coverMediaId: v.cover?.id ?? "",
        status, isFeatured: v.isFeatured, content: v.content ?? { type: "doc" },
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        return void toast.error(res.error);
      }
      setErrors({});
      setV((x) => ({ ...x, status }));
      toast.success(res.message);
      if (!postId) router.push(`/admin/news/${res.data.id}`);
      else router.refresh();
    });
  }

  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); save(v.status); }}>
    <fieldset disabled={!hydrated} className="grid min-w-0 gap-6 xl:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <Card>
          <CardContent className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="n-title">عنوان خبر</Label>
              <Input id="n-title" value={v.title} aria-invalid={!!errors.title} onChange={(e) => setV({ ...v, title: e.target.value, slug: slugTouched ? v.slug : slugify(e.target.value) })} />
              {err("title")}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="n-slug">نامک (آدرس خبر)</Label>
              <Input id="n-slug" value={v.slug} aria-invalid={!!errors.slug} onChange={(e) => { setSlugTouched(true); setV({ ...v, slug: e.target.value }); }} />
              {err("slug")}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="n-excerpt">خلاصه (اختیاری)</Label>
              <Textarea id="n-excerpt" rows={2} maxLength={500} value={v.excerpt} onChange={(e) => setV({ ...v, excerpt: e.target.value })} />
              <p className="text-xs text-muted-foreground">اگر خالی بماند، از ابتدای متن خبر ساخته می‌شود.</p>
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-1.5">
          <Label>متن خبر</Label>
          <RichTextEditor value={v.content} onChange={(content) => setV((x) => ({ ...x, content }))} label="متن خبر" />
          {err("content")}
        </div>
      </div>
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>انتشار</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-sm">وضعیت فعلی: <span className="font-semibold">{v.status === "PUBLISHED" ? "منتشرشده" : "پیش‌نویس"}</span></p>
            <div className="grid gap-1.5">
              <Label htmlFor="n-cat">دسته</Label>
              <NativeSelect id="n-cat" value={v.categoryId} onChange={(e) => setV({ ...v, categoryId: e.target.value })}>
                <option value="">— بدون دسته —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </NativeSelect>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={v.isFeatured} onChange={(e) => setV({ ...v, isFeatured: e.target.checked })} className="size-4 accent-[var(--brand-green-dark)]" />
              خبر ویژه (بالای صفحهٔ اخبار)
            </label>
            <div className="grid gap-2">
              <Button type="button" loading={pending} onClick={() => save("PUBLISHED")}>{v.status === "PUBLISHED" ? "ذخیرهٔ تغییرات" : "انتشار"}</Button>
              <Button type="button" variant="outline" disabled={pending} onClick={() => save("DRAFT")}>{v.status === "PUBLISHED" ? "بازگرداندن به پیش‌نویس" : "ذخیرهٔ پیش‌نویس"}</Button>
              {postId && v.status === "PUBLISHED" ? (
                <Button asChild variant="ghost"><Link href={`/news/${encodeURIComponent(v.slug)}`} target="_blank"><ExternalLink /> مشاهدهٔ خبر</Link></Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>تصویر شاخص</CardTitle></CardHeader>
          <CardContent><CoverPicker value={v.cover} onChange={(cover) => setV({ ...v, cover })} /></CardContent>
        </Card>
      </div>
    </fieldset>
    </form>
  );
}
