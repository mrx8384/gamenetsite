"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { logout } from "@/features/auth/actions";
import { revokeOtherSessions, revokeSession } from "@/features/account/actions";

export function RevokeSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await revokeSession(sessionId);
          if (res.ok) toast.success(res.message);
          else toast.error(res.error);
          router.refresh();
        })
      }
    >
      خروج این دستگاه
    </Button>
  );
}

export function SessionBulkActions({ otherCount }: { otherCount: number }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={otherCount === 0} onClick={() => setConfirmOpen(true)}>
        خروج از سایر دستگاه‌ها
      </Button>
      <Button variant="destructive" loading={pending} onClick={() => startTransition(() => logout())}>
        خروج از این دستگاه
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="خروج از سایر دستگاه‌ها؟"
        description="همهٔ دستگاه‌ها به‌جز همین دستگاه از حساب شما خارج می‌شوند."
        confirmLabel="بله، خارج شوند"
        onConfirm={async () => {
          const res = await revokeOtherSessions();
          if (res.ok) toast.success(res.message);
          else toast.error(res.error);
          router.refresh();
        }}
      />
    </div>
  );
}
