"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addToCart } from "@/features/cart/actions";
import { toPersianDigits } from "@/lib/format";

export function AddToCart({ productId, maxQuantity }: { productId: string; maxQuantity: number }) {
  const router = useRouter();
  const [qty, setQty] = React.useState(1);
  const [pending, startTransition] = React.useTransition();
  const max = Math.max(1, Math.min(10, maxQuantity));

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center rounded-lg border bg-surface" role="group" aria-label="تعداد">
        <Button type="button" variant="ghost" size="icon" onClick={() => setQty((q) => Math.min(max, q + 1))} disabled={qty >= max} aria-label="افزایش تعداد">
          <Plus />
        </Button>
        <span className="w-10 text-center font-bold" aria-live="polite">{toPersianDigits(qty)}</span>
        <Button type="button" variant="ghost" size="icon" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="کاهش تعداد">
          <Minus />
        </Button>
      </div>
      <Button
        size="lg"
        className="flex-1 sm:flex-none"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await addToCart({ productId, quantity: qty });
            if (!res.ok) return void toast.error(res.error);
            toast.success(res.message, { action: { label: "مشاهدهٔ سبد", onClick: () => router.push("/cart") } });
            router.refresh();
          })
        }
      >
        <ShoppingCart /> افزودن به سبد خرید
      </Button>
      <Link href="/cart" className="text-sm text-link hover:underline">
        سبد خرید
      </Link>
    </div>
  );
}
