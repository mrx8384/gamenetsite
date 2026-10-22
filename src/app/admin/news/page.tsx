import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { FolderTree, Newspaper, Plus, Search, Star } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { EmptyState, LoadingRows } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDate, formatNumber } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { normalizePersian } from "@/lib/text";

export const metadata: Metadata = { title: "اخبار" };
const PAGE_SIZE = 20;
type SP = { q?: string; status?: string; category?: string; page?: string };

export default function NewsAdminPage({ searchParams }: PageProps<"/admin/news">) {
  return (
    <>
      <AdminPageHeader
        title="اخبار"
        description="نوشتن، ویرایش و انتشار اخبار."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline"><Link href="/admin/news/categories"><FolderTree /> دسته‌های اخبار</Link></Button>
            <Button asChild><Link href="/admin/news/new"><Plus /> خبر جدید</Link></Button>
          </div>
        }
      />
      <Suspense fallback={<LoadingRows rows={8} />}><NewsTable searchParams={searchParams as Promise<SP>} /></Suspense>
    </>
  );
}

async function NewsTable({ searchParams }: { searchParams: Promise<SP> }) {
  await requireRole(["ADMIN"], "/admin/news");
  const sp = await searchParams;
  const q = normalizePersian(String(sp.q ?? "")).slice(0, 100);
  const status = sp.status === "DRAFT" || sp.status === "PUBLISHED" ? sp.status : undefined;
  const category = typeof sp.category === "string" && sp.category ? sp.category : undefined;
  const page = Math.max(1, Number.parseInt(String(sp.page ?? "1"), 10) || 1);
  const where: Prisma.NewsPostWhereInput = {
    ...(status ? { status } : {}),
    ...(category ? { categoryId: category } : {}),
    ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
  };
  const [total, posts, categories] = await Promise.all([
    db.newsPost.count({ where }),
    db.newsPost.findMany({
      where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      select: { id: true, title: true, status: true, isFeatured: true, publishedAt: true, updatedAt: true, category: { select: { name: true } }, cover: { select: { storageKey: true } } },
    }),
    db.newsCategory.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) => { const x = new URLSearchParams(); if (q) x.set("q", q); if (status) x.set("status", status); if (category) x.set("category", category); if (p > 1) x.set("page", String(p)); return `?${x}`; };
  return (
    <div className="space-y-4">
      <form className="grid gap-3 rounded-xl border bg-surface p-4 sm:grid-cols-[1fr_160px_180px_auto]" role="search">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input name="q" defaultValue={q} placeholder="عنوان خبر" className="ps-9" aria-label="جست‌وجو" />
        </div>
        <NativeSelect name="status" defaultValue={status ?? ""} aria-label="وضعیت">
          <option value="">همهٔ وضعیت‌ها</option>
          <option value="PUBLISHED">منتشرشده</option>
          <option value="DRAFT">پیش‌نویس</option>
        </NativeSelect>
        <NativeSelect name="category" defaultValue={category ?? ""} aria-label="دسته">
          <option value="">همهٔ دسته‌ها</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </NativeSelect>
        <Button type="submit" variant="strong">اعمال فیلتر</Button>
      </form>
      <p className="text-sm text-muted-foreground">{formatNumber(total)} خبر</p>
      {posts.length === 0 ? (
        <EmptyState icon={Newspaper} title="خبری پیدا نشد" action={<Button asChild><Link href="/admin/news/new"><Plus /> نوشتن خبر</Link></Button>} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20"><span className="sr-only">تصویر</span></TableHead>
              <TableHead>عنوان</TableHead>
              <TableHead>دسته</TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead>تاریخ انتشار</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="relative h-11 w-16 overflow-hidden rounded-md bg-secondary">
                    {p.cover ? <Image src={mediaUrl(p.cover.storageKey)} alt="" fill unoptimized sizes="64px" className="object-cover" /> : null}
                  </div>
                </TableCell>
                <TableCell>
                  <Link href={`/admin/news/${p.id}`} className="font-medium hover:text-link hover:underline">{p.title}</Link>
                  {p.isFeatured ? <Star className="ms-1.5 inline size-3.5 fill-brand-yellow text-warning" aria-label="ویژه" /> : null}
                </TableCell>
                <TableCell className="text-muted-foreground">{p.category?.name ?? "—"}</TableCell>
                <TableCell>{p.status === "PUBLISHED" ? <Badge variant="success">منتشرشده</Badge> : <Badge variant="secondary">پیش‌نویس</Badge>}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{p.publishedAt ? formatDate(p.publishedAt) : "—"}</TableCell>
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
