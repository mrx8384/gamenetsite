import { Badge } from "@/components/ui/badge";
import { formatToman, toPersianDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

export function discountPercent(price: bigint, compareAt: bigint | null): number {
  return compareAt && compareAt > price ? Number(((compareAt - price) * BigInt(100)) / compareAt) : 0;
}

export function PriceTag({ price, compareAtPrice, size = "md" }: { price: string; compareAtPrice: string | null; size?: "md" | "lg" }) {
  const p = BigInt(price);
  const c = compareAtPrice ? BigInt(compareAtPrice) : null;
  const pct = discountPercent(p, c);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className={cn("font-black", size === "lg" ? "text-2xl" : "text-base")}>{formatToman(p)}</span>
      {pct > 0 && c ? (
        <>
          <span className="text-sm text-muted-foreground line-through">{formatToman(c)}</span>
          <Badge variant="accent">٪{toPersianDigits(pct)} تخفیف</Badge>
        </>
      ) : null}
    </div>
  );
}
