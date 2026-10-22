import Image from "next/image";
import Link from "next/link";
import { ImageOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatToman, toPersianDigits } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import type { ProductCardData } from "@/features/store/queries";

export function ProductCard({ product }: { product: ProductCardData }) {
  const price = BigInt(product.price);
  const compareAt = product.compareAtPrice ? BigInt(product.compareAtPrice) : null;
  const discount = compareAt && compareAt > price ? Number(((compareAt - price) * BigInt(100)) / compareAt) : 0;

  return (
    <Link
      href={`/shop/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border bg-surface shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative aspect-square bg-secondary">
        {product.imageKey ? (
          <Image
            src={mediaUrl(product.imageKey)}
            alt={product.imageAlt ?? product.title}
            fill
            unoptimized
            sizes="(min-width: 1024px) 25vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <ImageOff className="size-8" aria-hidden />
          </div>
        )}
        {discount > 0 ? <Badge variant="accent" className="absolute start-3 top-3">٪{toPersianDigits(discount)} تخفیف</Badge> : null}
        {!product.inStock ? <Badge variant="strong" className="absolute end-3 top-3">ناموجود</Badge> : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {product.categoryName ? <p className="text-xs text-muted-foreground">{product.categoryName}</p> : null}
        <h3 className="line-clamp-2 leading-7 font-semibold">{product.title}</h3>
        <div className="mt-auto flex flex-wrap items-baseline gap-2 pt-1">
          <span className="font-bold">{formatToman(price)}</span>
          {discount > 0 && compareAt ? (
            <span className="text-xs text-muted-foreground line-through">{formatToman(compareAt)}</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
