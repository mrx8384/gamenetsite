"use client";

import * as React from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

export function ProductGallery({ images, title }: { images: { key: string; alt: string | null }[]; title: string }) {
  const [active, setActive] = React.useState(0);
  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-2xl border bg-secondary text-muted-foreground">
        <ImageOff className="size-10" aria-hidden />
      </div>
    );
  }
  const current = images[Math.min(active, images.length - 1)];
  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-2xl border bg-surface">
        <Image src={mediaUrl(current.key)} alt={current.alt || title} fill unoptimized priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-contain" />
      </div>
      {images.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="تصاویر محصول">
          {images.map((img, i) => (
            <button
              key={img.key}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`تصویر ${(i + 1).toLocaleString("fa-IR")}`}
              onClick={() => setActive(i)}
              className={cn(
                "relative size-20 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 bg-surface transition-colors",
                i === active ? "border-brand-green" : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              <Image src={mediaUrl(img.key)} alt="" fill unoptimized sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
