"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { ChevronLeft, Menu, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { overlayClassName } from "@/components/ui/dialog";
import { siteConfig } from "@/lib/brand";
import { isActivePath, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

/** Static placeholder shown until the client knows the current path. */
export function MobileNavFallback() {
  return (
    <Button variant="ghost" size="icon" className="lg:hidden" aria-label="باز کردن منو" disabled>
      <Menu className="size-5!" />
    </Button>
  );
}

/** Slide-in menu from the start (right) edge for screens below `lg`. */
export function MobileNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="باز کردن منو">
          <Menu className="size-5!" />
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlayClassName} />
        <DialogPrimitive.Content
          className="fixed inset-y-0 start-0 z-50 flex w-[min(20rem,85vw)] flex-col bg-background shadow-2xl outline-none data-[state=closed]:animate-sheet-out data-[state=open]:animate-sheet-in"
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <DialogPrimitive.Title className="flex items-center gap-2 text-sm font-bold">
              <Logo size={32} />
              {siteConfig.nameFa}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="بستن منو">
                <X />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="sr-only">پیوندهای اصلی سایت</DialogPrimitive.Description>
          <nav aria-label="منوی موبایل" className="flex-1 overflow-y-auto p-3">
            <ul className="space-y-1">
              {items.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center justify-between rounded-lg px-3 py-3 font-medium transition-colors hover:bg-secondary",
                        active && "bg-secondary text-foreground before:me-2 before:h-5 before:w-1 before:rounded-full before:bg-brand-green",
                      )}
                    >
                      <span className="flex-1">{item.label}</span>
                      <ChevronLeft className="size-4 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
