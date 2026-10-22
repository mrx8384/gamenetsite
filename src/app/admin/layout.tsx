import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
import { Logo } from "@/components/logo";
import { LoadingRows } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/dal";

export const metadata: Metadata = { title: { default: "پنل مدیریت", template: "%s | پنل مدیریت" }, robots: { index: false } };

/** Every admin page renders only after the server confirms the ADMIN role. */
async function AdminGate({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["ADMIN"], "/admin");
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="bg-brand-black text-brand-cream lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:shrink-0 lg:overflow-y-auto">
        <div className="flex items-center justify-between gap-3 p-4 lg:block">
          <Link href="/admin" className="flex items-center gap-2.5">
            <Logo size={36} />
            <span className="text-sm font-bold">پنل مدیریت آتم</span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-1 text-xs text-brand-cream/60 hover:text-brand-green lg:mt-3">
            <ExternalLink className="size-3.5" /> مشاهدهٔ سایت
          </Link>
        </div>
        <div className="px-3 pb-3 lg:pb-6">
          <AdminNav />
        </div>
        <p className="hidden px-4 pb-6 text-xs text-brand-cream/50 lg:block">وارد شده با: {user.name}</p>
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<div className="p-8"><LoadingRows rows={6} /></div>}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}
