import * as React from "react";
import { AlertOctagon, Inbox, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

interface StateProps {
  title: string;
  description?: React.ReactNode;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}

function StateShell({ title, description, icon: Icon, action, className, tone }: StateProps & { tone: "neutral" | "error" }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center",
        tone === "error" ? "border-destructive/30 bg-destructive-soft/40" : "bg-surface/60",
        className,
      )}
    >
      {Icon ? (
        <span
          className={cn(
            "flex size-12 items-center justify-center rounded-full",
            tone === "error" ? "bg-destructive-soft text-destructive" : "bg-secondary text-muted-foreground",
          )}
        >
          <Icon className="size-6" aria-hidden />
        </span>
      ) : null}
      <div className="max-w-sm space-y-1">
        <p className="font-semibold">{title}</p>
        {description ? <p className="text-sm leading-7 text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

export function EmptyState({ icon = Inbox, ...props }: StateProps) {
  return <StateShell icon={icon} tone="neutral" {...props} />;
}

export function ErrorState({
  icon = AlertOctagon,
  title = "مشکلی پیش آمد",
  description = "لطفاً دوباره تلاش کنید. اگر مشکل ادامه داشت با پشتیبانی تماس بگیرید.",
  ...props
}: Partial<StateProps>) {
  return <StateShell icon={icon} tone="error" title={title} description={description} {...props} />;
}

/** Generic list/table loading placeholder. */
export function LoadingRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)} role="status" aria-label="در حال بارگذاری">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
