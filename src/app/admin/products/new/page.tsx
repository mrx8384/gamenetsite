import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ProductForm } from "@/components/admin/store/product-form";
import { LoadingRows } from "@/components/ui/states";
import { getCategoryOptions } from "@/features/store/admin-queries";
import { requireRole } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "محصول جدید" };

export default function NewProductPage() {
  return (
    <>
      <AdminPageHeader title="محصول جدید" />
      <Suspense fallback={<LoadingRows rows={8} />}>
        <NewProductForm />
      </Suspense>
    </>
  );
}

async function NewProductForm() {
  await requireRole(["ADMIN"], "/admin/products/new");
  const categories = await getCategoryOptions();
  return (
    <ProductForm
      categories={categories}
      initial={{ title: "", slug: "", sku: "", categoryId: "", shortDescription: "", description: "", price: "", compareAtPrice: "", status: "DRAFT", isFeatured: false, initialStock: "0", images: [] }}
    />
  );
}
