"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Package, Pencil, StarOff } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { moveFeaturedProduct, unfeatureProduct } from "@/features/store/admin-actions";
import { mediaUrl } from "@/lib/media";

export interface FeaturedRow {
  id: string;
  title: string;
  active: boolean;
  imageKey: string | null;
}

/** Order of the «محصولات ویژه» on the homepage; the first `shown` active ones are displayed. */
export function FeaturedOrder({ products, shown }: { products: FeaturedRow[]; shown: number }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const fa = (n: number) => n.toLocaleString("fa-IR");
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error);
      else if (res.message) toast.success(res.message);
      router.refresh();
    });

  if (products.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="محصول ویژه‌ای انتخاب نشده"
        description="در ویرایش هر محصول، تیک «نمایش در «محصولات منتخب» صفحهٔ اصلی» را بزنید تا اینجا بیاید."
      />
    );
  }

  let activeRank = 0;
  return (
    <ol className="divide-y rounded-xl border bg-surface">
      {products.map((p, i) => {
        const onHome = p.active && ++activeRank <= shown;
        return (
          <li key={p.id} className="flex flex-wrap items-center gap-3 p-3">
            <span className="w-6 text-sm text-muted-foreground">{fa(i + 1)}</span>
            <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border bg-white">
              {p.imageKey ? <Image src={mediaUrl(p.imageKey)} alt="" fill unoptimized sizes="48px" className="object-cover" /> : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{p.title}</p>
              <p className="pt-0.5">
                {!p.active ? (
                  <Badge variant="warning">غیرفعال — نمایش داده نمی‌شود</Badge>
                ) : onHome ? (
                  <Badge variant="success">در صفحهٔ اصلی</Badge>
                ) : (
                  <Badge variant="secondary">{`بعد از ${fa(shown)} محصول اول — نمایش داده نمی‌شود`}</Badge>
                )}
              </p>
            </div>
            <div className="flex">
              <Button variant="ghost" size="icon-sm" aria-label={`جابه‌جایی «${p.title}» به بالا`} disabled={pending || i === 0} onClick={() => run(() => moveFeaturedProduct(p.id, "up"))}><ArrowUp /></Button>
              <Button variant="ghost" size="icon-sm" aria-label={`جابه‌جایی «${p.title}» به پایین`} disabled={pending || i === products.length - 1} onClick={() => run(() => moveFeaturedProduct(p.id, "down"))}><ArrowDown /></Button>
              <Button variant="ghost" size="icon-sm" asChild aria-label={`ویرایش «${p.title}»`}><Link href={`/admin/products/${p.id}`}><Pencil /></Link></Button>
              <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label={`برداشتن «${p.title}» از محصولات ویژه`} disabled={pending} onClick={() => run(() => unfeatureProduct(p.id))}><StarOff /></Button>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
