import type { Metadata } from "next";
import { breadcrumbJsonLd, jsonLdHtml, metaDescription, pageMetadata, seoPath } from "@/lib/seo";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ChevronLeft, PackageX } from "lucide-react";
import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/home/section-heading";
import { PurchaseBox } from "@/components/cart/purchase-box";
import { PriceTag } from "@/components/store/price-tag";
import { ProductCard } from "@/components/store/product-card";
import { ProductGallery } from "@/components/store/product-gallery";
import { Skeleton } from "@/components/ui/skeleton";
import { getProductBySlug, getRelatedProducts } from "@/features/store/queries";
import { env } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import { mediaUrl } from "@/lib/media";

function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function generateMetadata({ params }: PageProps<"/shop/[slug]">): Promise<Metadata> {
  const product = await getProductBySlug(decodeSlug((await params).slug));
  if (!product) return { title: "محصول پیدا نشد" };
  return pageMetadata({
    title: product.title,
    description: metaDescription(product.shortDescription) ?? `خرید ${product.title} از فروشگاه اتم گیم کلاب`,
    path: seoPath("shop", product.slug),
    image: product.images[0] ? mediaUrl(product.images[0].key) : undefined,
  });
}

export default function ProductPage({ params }: PageProps<"/shop/[slug]">) {
  return (
    <Container className="py-8 sm:py-12">
      <Suspense fallback={<ProductSkeleton />}>
        <ProductContent params={params} />
      </Suspense>
    </Container>
  );
}

async function ProductContent({ params }: { params: Promise<{ slug: string }> }) {
  const product = await getProductBySlug(decodeSlug((await params).slug));
  if (!product) notFound();
  const related = await getRelatedProducts(product.id, product.category?.slug ?? null);
  const inStock = product.stock > 0;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    sku: product.sku,
    description: product.shortDescription ?? undefined,
    image: product.images.map((i) => new URL(mediaUrl(i.key), env.APP_URL).toString()),
    offers: product.priceOnRequest ? undefined : {
      "@type": "Offer",
      priceCurrency: "IRR",
      price: product.price,
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: new URL(seoPath("shop", product.slug), env.APP_URL).toString(),
    },
  };
  const crumbs: [string, string][] = [["فروشگاه", "/shop"]];
  if (product.category?.parent) crumbs.push([product.category.parent.name, `/shop?category=${encodeURIComponent(product.category.parent.slug)}`]);
  if (product.category) crumbs.push([product.category.name, `/shop?category=${encodeURIComponent(product.category.slug)}`]);
  crumbs.push([product.title, seoPath("shop", product.slug)]);
  const breadcrumbs = breadcrumbJsonLd(env.APP_URL, crumbs);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml([jsonLd, breadcrumbs]) }} />
      <nav aria-label="مسیر" className="mb-6 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <Link href="/shop" className="hover:text-foreground">
          فروشگاه
        </Link>
        {product.category?.parent ? (
          <>
            <ChevronLeft className="size-4" aria-hidden />
            <Link href={`/shop?category=${encodeURIComponent(product.category.parent.slug)}`} className="hover:text-foreground">
              {product.category.parent.name}
            </Link>
          </>
        ) : null}
        {product.category ? (
          <>
            <ChevronLeft className="size-4" aria-hidden />
            <Link href={`/shop?category=${encodeURIComponent(product.category.slug)}`} className="hover:text-foreground">
              {product.category.name}
            </Link>
          </>
        ) : null}
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductGallery images={product.images} title={product.title} />
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl leading-[1.6] font-black sm:text-3xl">{product.title}</h1>
            <p className="ltr text-start text-xs text-muted-foreground">SKU: {product.sku}</p>
          </div>
          {product.priceOnRequest ? null : <PriceTag price={product.price} compareAtPrice={product.compareAtPrice} size="lg" />}
          <p className={inStock ? "flex items-center gap-2 font-medium text-success" : "flex items-center gap-2 font-medium text-destructive"}>
            {inStock ? <CheckCircle2 className="size-5" aria-hidden /> : <PackageX className="size-5" aria-hidden />}
            {inStock ? (product.stock <= 5 ? `موجود — فقط ${formatNumber(product.stock)} عدد باقی مانده` : "موجود در انبار") : "ناموجود"}
          </p>
          {product.shortDescription ? <p className="leading-8 text-muted-foreground">{product.shortDescription}</p> : null}
          <Suspense fallback={<Skeleton className="h-12 w-full" />}>
            <PurchaseBox productId={product.id} stock={product.stock} priceOnRequest={product.priceOnRequest} />
          </Suspense>
        </div>
      </div>

      {product.description ? (
        <section className="mt-12 max-w-3xl space-y-4">
          <h2 className="text-xl font-bold">توضیحات محصول</h2>
          {product.description.split(/\n{2,}/).map((para, i) => (
            <p key={i} className="leading-8 whitespace-pre-line text-foreground/85">
              {para}
            </p>
          ))}
        </section>
      ) : null}

      {related.length > 0 ? (
        <section className="mt-14">
          <SectionHeading title="محصولات مرتبط" />
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function ProductSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-2" role="status" aria-label="در حال بارگذاری">
      <Skeleton className="aspect-square rounded-2xl" />
      <div className="space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
