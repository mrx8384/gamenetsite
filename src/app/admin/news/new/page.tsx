import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { NewsForm } from "@/components/admin/news/news-form";
import { LoadingRows } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/dal";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "خبر جدید" };

export default function NewNewsPage() {
  return (
    <>
      <AdminPageHeader title="خبر جدید" />
      <Suspense fallback={<LoadingRows rows={8} />}><Form /></Suspense>
    </>
  );
}

async function Form() {
  await requireRole(["ADMIN"], "/admin/news/new");
  const categories = await db.newsCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } });
  return <NewsForm categories={categories} initial={{ title: "", slug: "", excerpt: "", categoryId: "", cover: null, status: "DRAFT", isFeatured: false, content: null }} />;
}
