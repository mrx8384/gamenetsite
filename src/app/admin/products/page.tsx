import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { ImageOff, Package, Plus, Search, Star } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { EmptyState, LoadingRows } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCategoryOptions } from "@/features/store/admin-queries";
import { requireRole } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatNumber, formatToman, toEnglishDigits } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { normalizePersian } from "@/lib/text";

export const metadata: Metadata = { title: "محصولات" };

const PAGE_SIZE = 20;
const statusLabel = { DRAFT: "پیش‌نویس", ACTIVE: "فعال", ARCHIVED: "بایگانی" } as const;
const statusVariant = { DRAFT: "secondary", ACTIVE: "success", ARCHIVED: "outline" } as const;
type SP = { q?: string; status?: string; category?: string; stock?: string; page?: string };

export default function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  return (
    <>
      <AdminPageHeader
        title="محصولات"
        description="مدیریت محصولات، قیمت‌ها و موجودی فروشگاه."
        actions={
          <Button asChild>
            <Link href="/admin/products/new">
              <Plus /> محصول جدید
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<LoadingRows rows={8} />}>
        <ProductsTable searchParams={searchParams as Promise<SP>} />
      </Suspense>
    </>
  );
}

async function ProductsTable({ searchParams }: { searchParams: Promise<SP> }) {
  await requireRole(["ADMIN"], "/admin/products");
  const sp = await searchParams;
  const q = normalizePersian(toEnglishDigits(String(sp.q ?? ""))).slice(0, 100);
  const status = sp.status === "DRAFT" || sp.status === "ACTIVE" || sp.status === "ARCHIVED" ? sp.status : undefined;
  const category = typeof sp.category === "string" && sp.category ? sp.category : undefined;
  const lowStock = sp.stock === "low";
  const page = Math.max(1, Number.parseInt(String(sp.page ?? "1"), 10) || 1);

  const where: Prisma.ProductWhereInput = {
    ...(status ? { status } : {}),
    ...(category ? { categoryId: category } : {}),
    ...(lowStock ? { stock: { lte: 5 } } : {}),
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { sku: { contains: q.toUpperCase() } }] } : {}),
  };
  const [total, products, categories] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, title: true, sku: true, price: true, stock: true, status: true, isFeatured: true,
        category: { select: { name: true } },
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { media: { select: { storageKey: true } } } },
      },
    }),
    getCategoryOptions(),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (category) params.set("category", category);
    if (lowStock) params.set("stock", "low");
    if (p > 1) params.set("page", String(p));
    return `?${params.toString()}`;
  };

  return (
    <div className="space-y-4">
      <form className="grid gap-3 rounded-xl border bg-surface p-4 md:grid-cols-[1fr_150px_170px_150px_auto]" role="search">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input name="q" defaultValue={q} placeholder="عنوان یا کد کالا" className="ps-9" aria-label="جست‌وجو" />
        </div>
        <NativeSelect name="status" defaultValue={status ?? ""} aria-label="وضعیت">
          <option value="">همهٔ وضعیت‌ها</option>
          <option value="ACTIVE">فعال</option>
          <option value="DRAFT">پیش‌نویس</option>
          <option value="ARCHIVED">بایگانی</option>
        </NativeSelect>
        <NativeSelect name="category" defaultValue={category ?? ""} aria-label="دسته">
          <option value="">همهٔ دسته‌ها</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.depth ? "— " : ""}{c.name}</option>
          ))}
        </NativeSelect>
        <NativeSelect name="stock" defaultValue={lowStock ? "low" : ""} aria-label="موجودی">
          <option value="">همهٔ موجودی‌ها</option>
          <option value="low">موجودی کم (۵ و کمتر)</option>
        </NativeSelect>
        <Button type="submit" variant="strong">اعمال فیلتر</Button>
      </form>

      <p className="text-sm text-muted-foreground">{formatNumber(total)} محصول</p>

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title={q || status || category || lowStock ? "محصولی پیدا نشد" : "هنوز محصولی اضافه نشده"}
          action={<Button asChild><Link href="/admin/products/new"><Plus /> افزودن محصول</Link></Button>}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16"><span className="sr-only">تصویر</span></TableHead>
              <TableHead>محصول</TableHead>
              <TableHead>دسته</TableHead>
              <TableHead>قیمت</TableHead>
              <TableHead>موجودی</TableHead>
              <TableHead>وضعیت</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="relative size-12 overflow-hidden rounded-lg bg-secondary">
                    {p.images[0] ? (
                      <Image src={mediaUrl(p.images[0].media.storageKey)} alt="" fill unoptimized sizes="48px" className="object-cover" />
                    ) : (
                      <ImageOff className="m-auto mt-3.5 size-5 text-muted-foreground" aria-hidden />
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Link href={`/admin/products/${p.id}`} className="font-medium hover:text-link hover:underline">
                    {p.title}
                  </Link>
                  {p.isFeatured ? <Star className="ms-1.5 inline size-3.5 fill-brand-yellow text-warning" aria-label="منتخب" /> : null}
                  <p className="ltr text-start text-xs text-muted-foreground">{p.sku}</p>
                </TableCell>
                <TableCell className="text-muted-foreground">{p.category?.name ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{formatToman(p.price)}</TableCell>
                <TableCell>
                  <Badge variant={p.stock === 0 ? "destructive" : p.stock <= 5 ? "warning" : "secondary"}>{formatNumber(p.stock)}</Badge>
                </TableCell>
                <TableCell><Badge variant={statusVariant[p.status]}>{statusLabel[p.status]}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {pages > 1 ? (
        <nav aria-label="صفحه‌بندی" className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">صفحهٔ {formatNumber(page)} از {formatNumber(pages)}</span>
          <div className="flex gap-2">
            {page > 1 ? <Button asChild variant="outline" size="sm"><Link href={qs(page - 1)}>قبلی</Link></Button> : null}
            {page < pages ? <Button asChild variant="outline" size="sm"><Link href={qs(page + 1)}>بعدی</Link></Button> : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
