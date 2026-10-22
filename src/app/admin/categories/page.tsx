import type { Metadata } from "next";
import { Suspense } from "react";
import { FolderTree, Pencil, Plus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { CategoryDialog } from "@/components/admin/store/category-dialog";
import { DeleteButton } from "@/components/admin/store/delete-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingRows } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteCategory } from "@/features/store/admin-actions";
import { requireRole } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "دسته‌بندی‌ها" };

export default function CategoriesPage() {
  return (
    <Suspense fallback={<LoadingRows rows={6} />}>
      <CategoriesContent />
    </Suspense>
  );
}

async function CategoriesContent() {
  await requireRole(["ADMIN"], "/admin/categories");
  const rows = await db.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, description: true, parentId: true, sortOrder: true, isActive: true, _count: { select: { products: true, children: true } } },
  });
  const roots = rows.filter((r) => !r.parentId);
  const ordered = roots.flatMap((r) => [r, ...rows.filter((c) => c.parentId === r.id)]);
  const orphans = rows.filter((r) => r.parentId && !roots.some((x) => x.id === r.parentId));
  const list = [...ordered, ...orphans.filter((o) => !ordered.includes(o))];
  const parents = roots.map((r) => ({ id: r.id, name: r.name }));

  return (
    <>
      <AdminPageHeader
        title="دسته‌بندی‌ها"
        description="دسته‌های محصولات فروشگاه (حداکثر دو سطح پیشنهاد می‌شود)."
        actions={<CategoryDialog parents={parents} trigger={<Button><Plus /> دستهٔ جدید</Button>} />}
      />
      {list.length === 0 ? (
        <EmptyState icon={FolderTree} title="هنوز دسته‌ای ساخته نشده" description="اولین دستهٔ محصولات را بسازید." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>نام</TableHead>
              <TableHead>نامک</TableHead>
              <TableHead>محصولات</TableHead>
              <TableHead>ترتیب</TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead className="w-24"><span className="sr-only">عملیات</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  {c.parentId ? <span className="me-1 text-muted-foreground">└</span> : null}
                  {c.name}
                </TableCell>
                <TableCell className="text-muted-foreground">{c.slug}</TableCell>
                <TableCell>{formatNumber(c._count.products)}</TableCell>
                <TableCell>{formatNumber(c.sortOrder)}</TableCell>
                <TableCell>{c.isActive ? <Badge variant="success">فعال</Badge> : <Badge variant="secondary">مخفی</Badge>}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <CategoryDialog
                      category={{ id: c.id, name: c.name, slug: c.slug, description: c.description, parentId: c.parentId, sortOrder: c.sortOrder, isActive: c.isActive }}
                      parents={parents}
                      trigger={<Button variant="ghost" size="icon-sm" aria-label={`ویرایش ${c.name}`}><Pencil /></Button>}
                    />
                    <DeleteButton
                      title={`حذف دستهٔ «${c.name}»؟`}
                      description="فقط دسته‌های بدون محصول و بدون زیرمجموعه قابل حذف هستند."
                      action={deleteCategory.bind(null, c.id)}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
