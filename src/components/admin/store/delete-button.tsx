"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { ActionResult } from "@/lib/action-result";

/** Generic "delete with confirmation" button for admin tables. */
export function DeleteButton({
  title,
  description,
  action,
  redirectTo,
  label,
}: {
  title: string;
  description: string;
  action: () => Promise<ActionResult<undefined>>;
  redirectTo?: string;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant={label ? "outline" : "ghost"} size={label ? "default" : "icon-sm"} onClick={() => setOpen(true)} aria-label={label ?? title} className={label ? "text-destructive" : undefined}>
        <Trash2 />
        {label}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        destructive
        title={title}
        description={description}
        confirmLabel="بله، حذف شود"
        onConfirm={async () => {
          const res = await action();
          if (!res.ok) return void toast.error(res.error);
          toast.success(res.message ?? "حذف شد.");
          if (redirectTo) router.push(redirectTo);
          router.refresh();
        }}
      />
    </>
  );
}
