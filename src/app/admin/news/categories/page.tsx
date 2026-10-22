import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, FolderTree, Pencil, Plus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { NewsCategoryDialog } from "@/components/admin/news/news-category-dialog";
import { DeleteButton } from "@/components/admin/store/delete-button";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingRows } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteNewsCategory } from "@/features/news/admin-actions";
import { requireRole } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "دسته‌های اخبار" };

export default function NewsCategoriesPage() {
  return (
    <>
      <Link href="/admin/news" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronRight className="size-4" /> اخبار</Link>
      <AdminPageHeader title="دسته‌های اخبار" actions={<NewsCategoryDialog trigger={<Button><Plus /> دستهٔ جدید</Button>} />} />
      <Suspense fallback={<LoadingRows rows={4} />}><List /></Suspense>
    </>
  );
}

async function List() {
  await requireRole(["ADMIN"], "/admin/news/categories");
  const rows = await db.newsCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { posts: true } } } });
  if (rows.length === 0) return <EmptyState icon={FolderTree} title="هنوز دسته‌ای ساخته نشده" />;
  return (
    <Table>
      <TableHeader><TableRow><TableHead>نام</TableHead><TableHead>نامک</TableHead><TableHead>خبرها</TableHead><TableHead className="w-24"><span className="sr-only">عملیات</span></TableHead></TableRow></TableHeader>
      <TableBody>
        {rows.map((c) => (
          <TableRow key={c.id}>
            <TableCell className="font-medium">{c.name}</TableCell>
            <TableCell className="text-muted-foreground">{c.slug}</TableCell>
            <TableCell>{formatNumber(c._count.posts)}</TableCell>
            <TableCell>
              <div className="flex gap-1">
                <NewsCategoryDialog category={{ id: c.id, name: c.name, slug: c.slug, sortOrder: c.sortOrder }} trigger={<Button variant="ghost" size="icon-sm" aria-label={`ویرایش ${c.name}`}><Pencil /></Button>} />
                <DeleteButton title={`حذف دستهٔ «${c.name}»؟`} description="اخبار این دسته حذف نمی‌شوند و بدون دسته باقی می‌مانند." action={deleteNewsCategory.bind(null, c.id)} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
