import type { Metadata } from "next";
import { Suspense } from "react";
import type { JSONContent } from "@tiptap/react";
import { PageEditor } from "@/components/admin/pages/page-editor";
import { LoadingRows } from "@/components/ui/states";
import { getPage } from "@/features/pages/queries";
import { requireRole } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "ویرایش درباره ما" };

export default function AboutEditorPage() {
  return (
    <Suspense fallback={<LoadingRows rows={6} />}>
      <Editor />
    </Suspense>
  );
}

async function Editor() {
  await requireRole(["ADMIN"], "/admin/settings/about");
  const page = await getPage("about");
  return <PageEditor slug="about" publicHref="/about" initialTitle={page?.title ?? "دربارهٔ اتم گیم کلاب"} initialContent={(page?.contentJson as JSONContent | null) ?? null} />;
}
