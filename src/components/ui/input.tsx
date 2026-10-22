import * as React from "react";
import { cn } from "@/lib/utils";

export const inputClassName =
  "w-full min-w-0 rounded-lg border border-input bg-surface px-3.5 text-base text-foreground transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-destructive/20 sm:text-sm";

export function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(inputClassName, "h-11", className)} {...props} />;
}
