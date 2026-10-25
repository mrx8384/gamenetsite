"use client";

import { Headset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OPEN_SUPPORT_EVENT } from "@/features/support/constants";

/** Opens the floating support chat. */
export function OpenSupportButton({ className }: { className?: string }) {
  return (
    <Button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_SUPPORT_EVENT))}>
      <Headset /> گفت‌وگوی آنلاین با پشتیبانی
    </Button>
  );
}
