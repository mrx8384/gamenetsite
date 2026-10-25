import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { FaqManager } from "@/components/admin/support/faq-manager";
import { LoadingRows } from "@/components/ui/states";
import { getAllFaqs } from "@/features/support/faq-queries";
import { requireRole } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "سؤالات متداول پشتیبانی" };

export default function SupportFaqPage() {
  return (
    <>
      <Link href="/admin/support" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4" /> پشتیبانی آنلاین
      </Link>
      <AdminPageHeader title="سؤالات متداول" description="وقتی کاربر در چت پشتیبانی تایپ می‌کند، جواب‌های مرتبط از همین فهرست به او پیشنهاد می‌شود (بدون هوش مصنوعی خارجی)." />
      <Suspense fallback={<LoadingRows rows={5} />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  await requireRole(["ADMIN", "SUPPORT"], "/admin/support/faq");
  const faqs = await getAllFaqs();
  return (
    <FaqManager
      faqs={faqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer, keywords: f.keywords, isActive: f.isActive, openCount: f.openCount, helpfulCount: f.helpfulCount }))}
    />
  );
}
