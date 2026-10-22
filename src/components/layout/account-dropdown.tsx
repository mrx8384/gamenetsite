"use client";

import Link from "next/link";
import { LayoutDashboard, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/features/auth/actions";

const roleLabel = { ADMIN: "مدیر", USER: "کاربر", PARTNER: "همکار" } as const;

export function AccountDropdown({ name, role }: { name: string; role: keyof typeof roleLabel }) {
  const initial = name.match(/\p{L}/u)?.[0] ?? "؟";
  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-44 gap-2 ps-1.5" aria-label="منوی حساب کاربری">
          <span className="flex size-7 items-center justify-center rounded-full bg-brand-green text-sm font-bold text-brand-black">{initial}</span>
          <span className="hidden truncate sm:inline">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <span className="block truncate font-semibold text-foreground">{name}</span>
          {roleLabel[role]}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account">
            <UserRound /> حساب کاربری
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/security">
            <ShieldCheck /> امنیت و نشست‌ها
          </Link>
        </DropdownMenuItem>
        {role === "ADMIN" ? (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <LayoutDashboard /> پنل مدیریت
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={() => void logout()}>
          <LogOut /> خروج
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
