"use client";

import * as React from "react";
import { AlertDialog } from "radix-ui";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { dialogContentClassName, overlayClassName } from "./dialog";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** May be async; the dialog shows a loading state and closes when it resolves. */
  onConfirm: () => void | Promise<void>;
}

/** Confirmation for irreversible or important actions (delete, approve, ...). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "تأیید",
  cancelLabel = "انصراف",
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [pending, setPending] = React.useState(false);

  async function handleConfirm(event: React.MouseEvent) {
    event.preventDefault();
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={overlayClassName} />
        <AlertDialog.Content className={cn(dialogContentClassName, "max-w-md")}>
          <div className="flex flex-col gap-1.5 text-start">
            <AlertDialog.Title className="text-lg font-bold">{title}</AlertDialog.Title>
            {description ? (
              <AlertDialog.Description className="text-sm leading-7 text-muted-foreground">
                {description}
              </AlertDialog.Description>
            ) : null}
          </div>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="outline" disabled={pending}>
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant={destructive ? "destructive" : "default"} loading={pending} onClick={handleConfirm}>
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
