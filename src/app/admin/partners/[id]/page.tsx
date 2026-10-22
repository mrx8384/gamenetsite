import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { ReviewActions } from "@/components/admin/partners/review-actions";
import { PartnerStatusBadge } from "@/components/partners/partner-status";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingRows } from "@/components/ui/states";
import { BUSINESS_TYPE_LABELS } from "@/features/partners/constants";
import { SUBSCRIPTION_STATUS_LABELS } from "@/features/subscriptions/constants";
import { requireRole } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "جزئیات همکار" };

export default function PartnerDetailPage({ params }: PageProps<"/admin/partners/[id]">) {
  return (
    <>
      <Link href="/admin/partners" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4" /> همکاران
      </Link>
      <Suspense fallback={<LoadingRows rows={6} />}>
        <PartnerDetail params={params} />
      </Suspense>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[160px_1fr]">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

async function PartnerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole(["ADMIN"], `/admin/partners/${id}`);
  const p = await db.partnerProfile.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, phone: true, email: true, role: true, isActive: true, createdAt: true } },
      reviewedBy: { select: { name: true } },
      subscriptions: { orderBy: { createdAt: "desc" }, include: { plan: { select: { name: true } } } },
    },
  });
  if (!p) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-black">{p.businessName} <PartnerStatusBadge status={p.status} /></h1>
          <p className="text-sm text-muted-foreground">درخواست: {formatDateTime(p.submittedAt)}{p.reviewedAt ? ` · بررسی: ${formatDateTime(p.reviewedAt)}${p.reviewedBy ? ` توسط ${p.reviewedBy.name}` : ""}` : ""}</p>
        </div>
        <ReviewActions id={p.id} status={p.status} businessName={p.businessName} />
      </div>
      {p.rejectionReason && p.status !== "APPROVED" ? <Alert variant="destructive">دلیل {p.status === "SUSPENDED" ? "تعلیق" : "رد"}: {p.rejectionReason}</Alert> : null}
      {!p.user.isActive ? <Alert variant="warning">حساب کاربری این همکار غیرفعال است.</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader><CardTitle>اطلاعات کسب‌وکار</CardTitle></CardHeader>
          <CardContent>
            <dl className="divide-y">
              <Row label="نوع">{BUSINESS_TYPE_LABELS[p.businessType]}</Row>
              <Row label="استان / شهر">{p.province}، {p.city}</Row>
              <Row label="نشانی">{p.address}</Row>
              <Row label="تلفن"><a className="ltr text-link" href={`tel:${p.phone}`}>{p.phone}</a></Row>
              <Row label="وب‌سایت">{p.website ? <a className="ltr break-all text-link" href={p.website} target="_blank" rel="noopener noreferrer nofollow">{p.website}</a> : "—"}</Row>
              <Row label="اینستاگرام">{p.instagram ? <a className="ltr text-link" href={`https://instagram.com/${p.instagram}`} target="_blank" rel="noopener noreferrer nofollow">@{p.instagram}</a> : "—"}</Row>
              <Row label="توضیحات"><span className="whitespace-pre-line">{p.description || "—"}</span></Row>
            </dl>
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>حساب کاربری</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium">{p.user.name}</p>
              {p.user.phone ? <p className="ltr text-start">{p.user.phone}</p> : null}
              {p.user.email ? <p className="ltr text-start">{p.user.email}</p> : null}
              <p className="text-muted-foreground">نقش: {p.user.role === "PARTNER" ? "همکار" : p.user.role === "ADMIN" ? "مدیر" : "کاربر عادی"} · عضویت: {formatDate(p.user.createdAt)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>اشتراک‌ها</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {p.subscriptions.length === 0 ? (
                <p className="text-muted-foreground">بدون اشتراک. خرید اشتراک فعلاً غیرفعال است.</p>
              ) : (
                p.subscriptions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2">
                    <span>{s.plan.name}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {s.endsAt ? `تا ${formatDate(s.endsAt)}` : null}
                      <Badge variant={s.status === "ACTIVE" ? "success" : "outline"}>{SUBSCRIPTION_STATUS_LABELS[s.status]}</Badge>
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
