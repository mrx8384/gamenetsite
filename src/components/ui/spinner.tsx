import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className, label = "در حال بارگذاری" }: { className?: string; label?: string }) {
  return (
    <span role="status" className="inline-flex items-center">
      <Loader2 className={cn("size-5 animate-spin text-brand-green-dark", className)} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}
