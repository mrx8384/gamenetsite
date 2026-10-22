import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { NewsForm } from "@/components/admin/news/news-form";
import { DeleteButton } from "@/components/admin/store/delete-button";
import { LoadingRows } from "@/components/ui/states";
import { deleteNewsPost } from "@/features/news/admin-actions";
import { requireRole } from "@/lib/auth/dal";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "ویرایش خبر" };

export default function EditNewsPage({ params }: PageProps<"/admin/news/[id]">) {
  return <Suspense fallback={<LoadingRows rows={8} />}><Edit params={params} /></Suspense>;
}

async function Edit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole(["ADMIN"], `/admin/news/${id}`);
  const [post, categories] = await Promise.all([
    db.newsPost.findUnique({ where: { id }, include: { cover: { select: { id: true, storageKey: true } } } }),
    db.newsCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  if (!post) notFound();
  return (
    <>
      <AdminPageHeader
        title={post.title}
        actions={<DeleteButton label="حذف خبر" title="حذف این خبر؟" description="این عمل قابل بازگشت نیست." action={deleteNewsPost.bind(null, post.id)} redirectTo="/admin/news" />}
      />
      <NewsForm
        postId={post.id}
        categories={categories}
        initial={{
          title: post.title, slug: post.slug, excerpt: post.excerpt ?? "", categoryId: post.categoryId ?? "",
          cover: post.cover, status: post.status, isFeatured: post.isFeatured, content: (post.contentJson as JSONContent | null) ?? null,
        }}
      />
    </>
  );
}
