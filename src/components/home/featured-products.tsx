import { connection } from "next/server";
import { ShoppingBag } from "lucide-react";
import { ProductCard } from "@/components/store/product-card";
import { EmptyState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { getFeaturedProducts } from "@/features/store/queries";

export async function FeaturedProducts() {
  await connection();
  const products = await getFeaturedProducts(4);
  if (products.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="محصولات به‌زودی اضافه می‌شوند"
        description="فروشگاه اتم در حال آماده‌سازی است. به‌زودی محصولات منتخب را اینجا می‌بینید."
      />
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

export function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4" role="status" aria-label="در حال بارگذاری">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="space-y-3 rounded-xl border bg-surface p-3">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ))}
    </div>
  );
}
