"use client";

import * as React from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadImages } from "@/features/media/actions";
import { mediaUrl } from "@/lib/media";

export interface ManagedImage {
  mediaId: string;
  storageKey: string;
  alt: string;
}

const MAX_IMAGES = 12;
const MAX_BYTES = 5 * 1024 * 1024;

/** Uploads images one by one (server re-encodes them) and lets the admin order them. First = main image. */
export function ImageManager({ value, onChange, folder = "products" }: { value: ManagedImage[]; onChange: (v: ManagedImage[]) => void; folder?: string }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);
  // Latest list for the sequential upload loop (each upload appends to the current value).
  const latest = React.useRef(value);
  React.useEffect(() => {
    latest.current = value;
  }, [value]);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, MAX_IMAGES - latest.current.length);
    if (list.length < files.length) toast.warning(`حداکثر ${MAX_IMAGES.toLocaleString("fa-IR")} تصویر برای هر محصول مجاز است.`);
    setProgress({ done: 0, total: list.length });
    for (const [i, file] of list.entries()) {
      if (file.size > MAX_BYTES) {
        toast.error(`«${file.name}» بزرگ‌تر از ۵ مگابایت است.`);
        continue;
      }
      const fd = new FormData();
      fd.set("folder", folder);
      fd.append("files", file);
      const res = await uploadImages(fd);
      if (!res.ok) toast.error(res.error);
      else {
        latest.current = [...latest.current, ...res.data.map((m) => ({ mediaId: m.id, storageKey: m.storageKey, alt: "" }))];
        onChange(latest.current);
      }
      setProgress({ done: i + 1, total: list.length });
    }
    setProgress(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function move(index: number, dir: -1 | 1) {
    const next = [...value];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {value.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {value.map((img, i) => (
            <li key={img.mediaId} className="overflow-hidden rounded-xl border bg-surface">
              <div className="relative aspect-square bg-secondary">
                <Image src={mediaUrl(img.storageKey)} alt={img.alt} fill unoptimized sizes="200px" className="object-cover" />
                {i === 0 ? <Badge variant="strong" className="absolute start-2 top-2">تصویر اصلی</Badge> : null}
              </div>
              <div className="space-y-2 p-2">
                <Input
                  value={img.alt}
                  onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, alt: e.target.value } : v)))}
                  placeholder="متن جایگزین (اختیاری)"
                  className="h-9 text-xs"
                  aria-label={`متن جایگزین تصویر ${(i + 1).toLocaleString("fa-IR")}`}
                />
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    <Button type="button" variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="جابه‌جایی به قبل">
                      <ArrowRight />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label="جابه‌جایی به بعد">
                      <ArrowLeft />
                    </Button>
                  </div>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="حذف تصویر">
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
      <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} loading={!!progress} disabled={value.length >= MAX_IMAGES}>
        <ImagePlus />
        {progress ? `در حال بارگذاری ${progress.done.toLocaleString("fa-IR")} از ${progress.total.toLocaleString("fa-IR")}` : "افزودن تصویر"}
      </Button>
      <p className="text-xs text-muted-foreground">JPG، PNG، WebP، AVIF یا GIF — حداکثر ۵ مگابایت. تصاویر به‌صورت خودکار بهینه می‌شوند.</p>
    </div>
  );
}
