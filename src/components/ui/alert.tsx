import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const alertVariants = cva("flex gap-3 rounded-xl border p-4 text-sm leading-7 [&>svg]:mt-1 [&>svg]:size-4 [&>svg]:shrink-0", {
  variants: {
    variant: {
      info: "border-info/20 bg-info-soft text-foreground [&>svg]:text-info",
      success: "border-success/20 bg-success-soft text-foreground [&>svg]:text-success",
      warning: "border-warning/20 bg-warning-soft text-foreground [&>svg]:text-warning",
      destructive: "border-destructive/20 bg-destructive-soft text-foreground [&>svg]:text-destructive",
    },
  },
  defaultVariants: { variant: "info" },
});

const icons = { info: Info, success: CheckCircle2, warning: AlertTriangle, destructive: XCircle } as const;

/** Inline notification for page-level messages. Use toasts for transient feedback. */
export function Alert({
  className,
  variant = "info",
  title,
  children,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants> & { title?: string }) {
  const Icon = icons[variant ?? "info"];
  return (
    <div role={variant === "destructive" ? "alert" : "status"} className={cn(alertVariants({ variant }), className)} {...props}>
      <Icon aria-hidden />
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-muted-foreground">{children}</div> : null}
      </div>
    </div>
  );
}
