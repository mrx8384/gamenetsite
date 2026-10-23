"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function PasswordInput({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      {/* The input is LTR (passwords), the page is RTL: the toggle sits at the page's end (left), which is the input's start, so the input reserves space with ps-11. */}
      <Input type={visible ? "text" : "password"} dir="ltr" className={cn("ps-11 text-start", className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute end-1 top-1/2 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
        aria-label={visible ? "پنهان کردن رمز عبور" : "نمایش رمز عبور"}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
