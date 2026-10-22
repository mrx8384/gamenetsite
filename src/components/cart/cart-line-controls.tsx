"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removeCartItem, updateCartItem } from "@/features/cart/actions";
import { toPersianDigits } from "@/lib/format";

export function CartLineControls({ itemId, quantity, max }: { itemId: string; quantity: number; max: number }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error);
      router.refresh();
    });
  const limit = Math.max(1, Math.min(10, max));
  return (
    <div className="flex items-center gap-2" aria-busy={pending}>
      <div className="flex items-center rounded-lg border bg-surface">
        <Button variant="ghost" size="icon-sm" disabled={pending || quantity >= limit} onClick={() => run(() => updateCartItem(itemId, quantity + 1))} aria-label="افزایش">
          <Plus />
        </Button>
        <span className="w-8 text-center text-sm font-bold">{toPersianDigits(quantity)}</span>
        <Button variant="ghost" size="icon-sm" disabled={pending || quantity <= 1} onClick={() => run(() => updateCartItem(itemId, quantity - 1))} aria-label="کاهش">
          <Minus />
        </Button>
      </div>
      <Button variant="ghost" size="icon-sm" disabled={pending} onClick={() => run(() => removeCartItem(itemId))} aria-label="حذف از سبد">
        <Trash2 className="text-destructive" />
      </Button>
    </div>
  );
}
