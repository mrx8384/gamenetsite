"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function PasswordInput({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} dir="ltr" className={cn("pe-11 text-start", className)} {...props} />
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
