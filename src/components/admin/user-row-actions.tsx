"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Handshake, Headset, LogOut, MoreHorizontal, ShieldCheck, Trash2, UserCheck, UserRound, UserX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteUser, revokeAllUserSessions, setUserActive, setUserRole } from "@/features/users/actions";
import type { ActionResult } from "@/lib/action-result";

type Role = "ADMIN" | "USER" | "PARTNER" | "SUPPORT";
const roleLabel: Record<Role, string> = { ADMIN: "مدیر", USER: "کاربر عادی", PARTNER: "همکار", SUPPORT: "پشتیبان" };

interface PendingAction {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  run: () => Promise<ActionResult<undefined>>;
}

export function UserRowActions({
  user,
  isSelf,
  deleteBlocker,
}: {
  user: { id: string; name: string; role: Role; isActive: boolean; hasPartnerProfile?: boolean };
  isSelf: boolean;
  /** Why the account can't be deleted (admin, orders, paid subscription), or null. */
  deleteBlocker: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<PendingAction | null>(null);

  const roleAction = (role: Role): PendingAction => ({
    title: `تغییر نقش به «${roleLabel[role]}»؟`,
    description: `نقش «${user.name}» تغییر می‌کند و کاربر برای اعمال دسترسی جدید باید دوباره وارد شود.`,
    confirmLabel: "تغییر نقش",
    destructive: role !== "ADMIN" && user.role === "ADMIN",
    run: () => setUserRole(user.id, role),
  });

  return (
    <>
      <DropdownMenu dir="rtl">
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`عملیات برای ${user.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>تغییر نقش</DropdownMenuLabel>
          {user.role === "PARTNER" ? (
            <DropdownMenuItem asChild>
              <Link href="/admin/partners"><Handshake /> مدیریت در بخش همکاران</Link>
            </DropdownMenuItem>
          ) : (
            (["USER", "SUPPORT", "ADMIN"] as const).map((role) => {
              const Icon = role === "ADMIN" ? ShieldCheck : role === "SUPPORT" ? Headset : UserRound;
              return (
                <DropdownMenuItem key={role} disabled={isSelf || user.role === role} onSelect={() => setPending(roleAction(role))}>
                  <Icon /> {roleLabel[role]}
                </DropdownMenuItem>
              );
            })
          )}
          <DropdownMenuSeparator />
          {user.isActive ? (
            <DropdownMenuItem
              destructive
              disabled={isSelf}
              onSelect={() =>
                setPending({
                  title: "غیرفعال کردن حساب؟",
                  description: `«${user.name}» دیگر نمی‌تواند وارد شود و از همهٔ دستگاه‌ها خارج می‌شود. اطلاعات حساب حذف نمی‌شود.`,
                  confirmLabel: "غیرفعال شود",
                  destructive: true,
                  run: () => setUserActive(user.id, false),
                })
              }
            >
              <UserX /> غیرفعال کردن
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onSelect={() =>
                setPending({
                  title: "فعال کردن حساب؟",
                  description: `«${user.name}» دوباره می‌تواند وارد شود.`,
                  confirmLabel: "فعال شود",
                  run: () => setUserActive(user.id, true),
                })
              }
            >
              <UserCheck /> فعال کردن
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() =>
              setPending({
                title: "خروج از همهٔ دستگاه‌ها؟",
                description: `همهٔ نشست‌های «${user.name}» بسته می‌شود.`,
                confirmLabel: "خروج از همه",
                run: () => revokeAllUserSessions(user.id),
              })
            }
          >
            <LogOut /> خروج از همهٔ دستگاه‌ها
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            destructive
            disabled={isSelf}
            onSelect={() =>
              deleteBlocker
                ? toast.error(deleteBlocker)
                : setPending({
                    title: "حذف همیشگی حساب؟",
                    description: `حساب «${user.name}» برای همیشه حذف می‌شود؛ همراه با نشانی‌ها، سبد خرید، گفت‌وگوهای پشتیبانی، امتیازها و کارت‌های تخفیفش${user.hasPartnerProfile ? "، و پروندهٔ همکاری و اشتراک‌های رایگانش (تورنومنت‌هایی که برگزار کرده می‌مانند و مدیران آن‌ها را مدیریت می‌کنند)" : ""}. این کار برگشت ندارد. اگر فقط می‌خواهید دیگر وارد نشود، «غیرفعال کردن» را بزنید.`,
                    confirmLabel: "حذف همیشگی",
                    destructive: true,
                    run: () => deleteUser(user.id),
                  })
            }
          >
            <Trash2 /> حذف حساب
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {pending ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPending(null)}
          title={pending.title}
          description={pending.description}
          confirmLabel={pending.confirmLabel}
          destructive={pending.destructive}
          onConfirm={async () => {
            const res = await pending.run();
            if (res.ok) toast.success(res.message ?? "انجام شد.");
            else toast.error(res.error);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
