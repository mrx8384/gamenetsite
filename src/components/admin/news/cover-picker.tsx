"use client";

import * as React from "react";
import Image from "next/image";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { uploadImages } from "@/features/media/actions";
import { mediaUrl } from "@/lib/media";

export function CoverPicker({ value, onChange }: { value: { id: string; storageKey: string } | null; onChange: (v: { id: string; storageKey: string } | null) => void }) {
  const ref = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  async function upload(file: File) {
    if (file.size > 5 * 1024 * 1024) return void toast.error("حجم تصویر باید حداکثر ۵ مگابایت باشد.");
    setBusy(true);
    const fd = new FormData();
    fd.set("folder", "news");
    fd.append("files", file);
    const res = await uploadImages(fd);
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    onChange(res.data[0]);
  }
  return (
    <div className="space-y-3">
      {value ? (
        <div className="relative aspect-[16/9] overflow-hidden rounded-xl border bg-secondary">
          <Image src={mediaUrl(value.storageKey)} alt="تصویر شاخص" fill unoptimized sizes="400px" className="object-cover" />
        </div>
      ) : (
        <div className="flex aspect-[16/9] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">بدون تصویر شاخص</div>
      )}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" loading={busy} onClick={() => ref.current?.click()}><ImagePlus /> {value ? "تغییر تصویر" : "انتخاب تصویر"}</Button>
        {value ? <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}><Trash2 className="text-destructive" /> حذف</Button> : null}
      </div>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
    </div>
  );
}
