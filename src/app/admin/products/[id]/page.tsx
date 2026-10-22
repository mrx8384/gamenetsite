import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { DeleteButton } from "@/components/admin/store/delete-button";
import { ProductForm } from "@/components/admin/store/product-form";
import { StockAdjustDialog } from "@/components/admin/store/stock-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingRows } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteProduct } from "@/features/store/admin-actions";
import { getCategoryOptions } from "@/features/store/admin-queries";
import { requireRole } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDateTime, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "ویرایش محصول" };

const reasonLabel = { MANUAL: "دستی", ORDER: "سفارش", ORDER_CANCEL: "لغو سفارش", RETURN: "مرجوعی", CORRECTION: "اصلاح شمارش" } as const;

export default function EditProductPage({ params }: PageProps<"/admin/products/[id]">) {
  return (
    <Suspense fallback={<LoadingRows rows={8} />}>
      <EditProduct params={params} />
    </Suspense>
  );
}

async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole(["ADMIN"], `/admin/products/${id}`);
  const [product, categories, movements] = await Promise.all([
    db.product.findUnique({
      where: { id },
      include: { images: { orderBy: { sortOrder: "asc" }, include: { media: { select: { storageKey: true } } } } },
    }),
    getCategoryOptions(),
    db.inventoryMovement.findMany({
      where: { productId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, delta: true, reason: true, note: true, createdAt: true, actor: { select: { name: true } } },
    }),
  ]);
  if (!product) notFound();
  const desc = product.descriptionJson as { format?: string; text?: string } | null;

  return (
    <>
      <AdminPageHeader
        title={product.title}
        description={`SKU: ${product.sku}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {product.status === "ACTIVE" ? (
              <Button asChild variant="outline">
                <Link href={`/shop/${encodeURIComponent(product.slug)}`} target="_blank">
                  <ExternalLink /> مشاهده در فروشگاه
                </Link>
              </Button>
            ) : null}
            <DeleteButton
              label="حذف"
              title="حذف این محصول؟"
              description="محصولاتی که در سفارش‌ها استفاده شده‌اند حذف نمی‌شوند؛ آن‌ها را بایگانی کنید."
              action={deleteProduct.bind(null, product.id)}
              redirectTo="/admin/products"
            />
          </div>
        }
      />

      <Card className="mb-6">
        <CardHeader className="flex-row items-center justify-between gap-3 sm:flex-row">
          <div>
            <CardTitle>موجودی انبار</CardTitle>
            <p className={cn("mt-1 text-3xl font-black", product.stock === 0 && "text-destructive")}>{formatNumber(product.stock)} عدد</p>
          </div>
          <StockAdjustDialog productId={product.id} stock={product.stock} />
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">هنوز تغییری در موجودی ثبت نشده است.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>تاریخ</TableHead>
                  <TableHead>تغییر</TableHead>
                  <TableHead>دلیل</TableHead>
                  <TableHead>توضیح</TableHead>
                  <TableHead>توسط</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(m.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant={m.delta > 0 ? "success" : "destructive"}>
                        <span className="ltr">{m.delta > 0 ? "+" : "−"}{formatNumber(Math.abs(m.delta))}</span>
                      </Badge>
                    </TableCell>
                    <TableCell>{reasonLabel[m.reason]}</TableCell>
                    <TableCell className="text-muted-foreground">{m.note ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{m.actor?.name ?? "سیستم"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ProductForm
        productId={product.id}
        categories={categories}
        initial={{
          title: product.title,
          slug: product.slug,
          sku: product.sku,
          categoryId: product.categoryId ?? "",
          shortDescription: product.shortDescription ?? "",
          description: desc?.format === "plain" ? (desc.text ?? "") : "",
          price: (product.price / BigInt(10)).toString(),
          compareAtPrice: product.compareAtPrice ? (product.compareAtPrice / BigInt(10)).toString() : "",
          status: product.status,
          isFeatured: product.isFeatured,
          initialStock: "0",
          images: product.images.map((i) => ({ mediaId: i.mediaId, storageKey: i.media.storageKey, alt: i.alt ?? "" })),
        }}
      />
    </>
  );
}
