"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ImagePlus, Loader2, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addCatalogGame } from "@/features/game-catalog/admin-actions";
import { CATEGORY_MAX, GAME_NAME_MAX, nameFromFileName, type Platform } from "@/features/game-catalog/constants";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { resizeForUpload } from "./resize-image";

interface QueueItem {
  key: string;
  file: File;
  name: string;
  preview: string;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

/** Add one game or many at once (bulk upload: names come from file names). Files are uploaded one per request. */
export function AddGamesCard({ platform, categoryNames }: { platform: Platform; categoryNames: string[] }) {
  const router = useRouter();
  const [category, setCategory] = React.useState("");
  const [queue, setQueue] = React.useState<QueueItem[]>([]);
  const [dragging, setDragging] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const previews = React.useRef(new Set<string>());

  React.useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  function addFiles(list: FileList | File[]) {
    const files = [...list].filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return void toast.error("فقط فایل تصویری قابل افزودن است.");
    setQueue((q) => [
      ...q.filter((i) => i.status !== "done"),
      ...files.map((file) => {
        const preview = URL.createObjectURL(file);
        previews.current.add(preview);
        return { key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`, file, name: nameFromFileName(file.name), preview, status: "pending" as const };
      }),
    ]);
  }

  function update(key: string, patch: Partial<QueueItem>) {
    setQueue((q) => q.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  async function upload() {
    const items = queue.filter((i) => i.status === "pending" || i.status === "error");
    if (items.length === 0) return;
    setBusy(true);
    let ok = 0;
    for (const item of items) {
      update(item.key, { status: "uploading", error: undefined });
      try {
        const fd = new FormData();
        fd.set("platform", platform);
        fd.set("name", item.name.trim() || nameFromFileName(item.file.name));
        fd.set("category", category);
        fd.set("file", await resizeForUpload(item.file));
        const res = await addCatalogGame(fd);
        if (res.ok) {
          ok++;
          update(item.key, { status: "done" });
        } else update(item.key, { status: "error", error: res.error });
      } catch {
        update(item.key, { status: "error", error: "ارسال ناموفق بود." });
      }
    }
    setBusy(false);
    if (ok > 0) {
      toast.success(`${formatNumber(ok)} بازی به ${platform} اضافه شد.`);
      router.refresh();
    }
    if (ok < items.length) toast.error(`${formatNumber(items.length - ok)} مورد ناموفق بود.`);
  }

  const pending = queue.filter((i) => i.status === "pending" || i.status === "error").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>افزودن بازی به <span className="ltr">{platform}</span></CardTitle>
        <CardDescription>یک یا چند تصویر انتخاب کنید. نام هر بازی از نام فایل گرفته می‌شود و قبل از ارسال قابل ویرایش است.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-1.5">
          <Label htmlFor="add-category">دسته‌بندی</Label>
          <Input id="add-category" list="catalog-category-names" value={category} maxLength={CATEGORY_MAX} onChange={(e) => setCategory(e.target.value)} placeholder="خالی = «بدون دسته»؛ نام جدید = ساخت دستهٔ جدید" />
          <datalist id="catalog-category-names">
            {categoryNames.map((n) => <option key={n} value={n} />)}
          </datalist>
          {categoryNames.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {categoryNames.map((n) => (
                <button key={n} type="button" onClick={() => setCategory(n)} className={cn("cursor-pointer rounded-full border px-2.5 py-0.5 text-xs", category === n ? "border-brand-black bg-brand-black text-brand-cream" : "hover:bg-secondary")}>
                  {n}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
          className={cn("flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors", dragging ? "border-brand-green bg-success-soft" : "bg-secondary/40")}
        >
          <ImagePlus className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-sm">تصاویر را اینجا رها کنید یا</p>
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>انتخاب تصاویر</Button>
          <input ref={inputRef} type="file" accept="image/*" multiple className="sr-only" aria-label="انتخاب تصاویر بازی" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
        </div>

        {queue.length > 0 ? (
          <ul className="divide-y rounded-xl border">
            {queue.map((item) => (
              <li key={item.key} className="flex items-center gap-3 p-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                <img src={item.preview} alt="" className="h-14 w-11 shrink-0 rounded-md object-cover" />
                <div className="min-w-0 flex-1">
                  <Input
                    aria-label="نام بازی"
                    value={item.name}
                    maxLength={GAME_NAME_MAX}
                    disabled={item.status === "uploading" || item.status === "done"}
                    onChange={(e) => update(item.key, { name: e.target.value })}
                    className="h-9"
                  />
                  {item.error ? <p role="alert" className="mt-1 text-xs text-destructive">{item.error}</p> : null}
                </div>
                <span className="shrink-0" aria-live="polite">
                  {item.status === "uploading" ? <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="در حال ارسال" /> : null}
                  {item.status === "done" ? <CheckCircle2 className="size-5 text-success" aria-label="اضافه شد" /> : null}
                  {item.status === "error" ? <XCircle className="size-5 text-destructive" aria-label="ناموفق" /> : null}
                  {item.status === "pending" ? (
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="حذف از فهرست" onClick={() => setQueue((q) => q.filter((i) => i.key !== item.key))}>
                      <Trash2 />
                    </Button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={upload} loading={busy} disabled={pending === 0}>
            {pending > 0 ? `افزودن ${formatNumber(pending)} بازی` : "افزودن بازی"}
          </Button>
          {queue.length > 0 && !busy ? (
            <Button type="button" variant="ghost" onClick={() => setQueue([])}>پاک کردن فهرست</Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
