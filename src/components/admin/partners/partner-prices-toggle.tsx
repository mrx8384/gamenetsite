"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setPartnerPricesVisible } from "@/features/partners/admin-actions";

/** Admin switch: does this partner see (and pay) product partner prices? */
export function PartnerPricesToggle({ id, initial, disabled }: { id: string; initial: boolean; disabled?: boolean }) {
  const router = useRouter();
  const [on, setOn] = React.useState(initial);
  const [pending, startTransition] = React.useTransition();
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm">
      <input
        type="checkbox"
        className="mt-1 size-4 accent-[var(--brand-green-dark)]"
        checked={on}
        disabled={pending || disabled}
        onChange={(e) => {
          const next = e.target.checked;
          setOn(next);
          startTransition(async () => {
            const res = await setPartnerPricesVisible(id, next);
            if (!res.ok) {
              setOn(!next);
              return void toast.error(res.error);
            }
            toast.success(res.message);
            router.refresh();
          });
        }}
      />
      <span>
        <span className="font-semibold">نمایش قیمت همکاری</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{disabled ? "فقط برای همکار تأییدشده اعمال می‌شود." : "قیمت همکار محصولات به این همکار نشان داده می‌شود و با آن خرید می‌کند."}</span>
      </span>
    </label>
  );
}
