import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Gamepad, Handshake, Lock, ShieldCheck, Trophy } from "lucide-react";
import { Container } from "@/components/layout/container";
import { PartnerForm } from "@/components/partners/partner-form";
import { PartnerStatusBadge } from "@/components/partners/partner-status";
import { PlanCards } from "@/components/partners/plan-cards";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingRows } from "@/components/ui/states";
import { BUSINESS_TYPE_LABELS } from "@/features/partners/constants";
import { currentSubscription, getMyPartnerProfile, getVisiblePlans, type MyPartnerProfile } from "@/features/partners/queries";
import { getSiteSettings } from "@/features/settings/site";
import { hasEntitlement } from "@/features/subscriptions/entitlements";
import { requireUser } from "@/lib/auth/dal";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "پنل همکار", robots: { index: false } };

export default function PartnerPage() {
  return (
    <Container className="py-8 sm:py-12">
      <h1 className="mb-6 flex items-center gap-3 text-3xl font-black">
        <span className="h-8 w-1.5 rounded-full bg-brand-green" aria-hidden />
        پنل همکار
      </h1>
      <Suspense fallback={<LoadingRows rows={6} />}>
        <PartnerContent />
      </Suspense>
    </Container>
  );
}

function toFormValues(p: MyPartnerProfile) {
  return {
    businessName: p.businessName,
    businessType: p.businessType,
    province: p.province,
    city: p.city,
    address: p.address,
    phone: p.phone,
    website: p.website ?? "",
    instagram: p.instagram ?? "",
    description: p.description ?? "",
  };
}

async function PartnerContent() {
  const user = await requireUser("/partner");
  const [profile, t] = await Promise.all([getMyPartnerProfile(user.id), getSiteSettings("partners")]);

  if (user.role === "ADMIN" && !profile) {
    return <Alert variant="info">حساب مدیر نمی‌تواند درخواست همکاری ثبت کند. درخواست‌ها را از <Link className="text-link underline" href="/admin/partners">پنل مدیریت ← همکاران</Link> بررسی کنید.</Alert>;
  }

  if (!profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Handshake className="size-5" /> درخواست همکاری</CardTitle>
          <CardDescription className="leading-7">{t.applyNote}</CardDescription>
        </CardHeader>
        <CardContent><PartnerForm submitLabel="ثبت درخواست همکاری" /></CardContent>
      </Card>
    );
  }

  if (profile.status !== "APPROVED") {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-lg font-bold">{profile.businessName}</p>
          <PartnerStatusBadge status={profile.status} />
        </div>
        {profile.status === "PENDING" ? <Alert variant="warning">{t.pendingText} <span className="text-muted-foreground">(ارسال: {formatDateTime(profile.submittedAt)})</span></Alert> : null}
        {profile.status === "REJECTED" ? (
          <Alert variant="destructive">
            درخواست شما رد شد.{profile.rejectionReason ? <> دلیل: {profile.rejectionReason}</> : null} می‌توانید اطلاعات را اصلاح و دوباره ارسال کنید.
          </Alert>
        ) : null}
        {profile.status === "SUSPENDED" ? (
          <Alert variant="destructive">
            حساب همکاری شما تعلیق شده است.{profile.rejectionReason ? <> دلیل: {profile.rejectionReason}</> : null} برای پیگیری از <Link className="text-link underline" href="/contact">صفحهٔ تماس</Link> با ما در ارتباط باشید.
          </Alert>
        ) : null}
        {profile.status !== "SUSPENDED" ? (
          <Card>
            <CardHeader><CardTitle>{profile.status === "PENDING" ? "ویرایش درخواست" : "اصلاح و ارسال دوباره"}</CardTitle></CardHeader>
            <CardContent>
              <PartnerForm initial={toFormValues(profile)} submitLabel={profile.status === "PENDING" ? "ذخیرهٔ تغییرات" : "ارسال دوباره برای بررسی"} />
            </CardContent>
          </Card>
        ) : null}
      </div>
    );
  }

  const [plans, gamepad] = await Promise.all([getVisiblePlans(), hasEntitlement(user.id, "GAMEPAD_TESTER")]);
  const sub = currentSubscription(profile);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-lg font-bold">{profile.businessName}</p>
        <PartnerStatusBadge status="APPROVED" />
        <span className="text-sm text-muted-foreground">{BUSINESS_TYPE_LABELS[profile.businessType]} · {profile.city}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="size-5" /> اشتراک</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {sub ? (
              <>
                <p className="font-semibold">{sub.plan.name} <Badge variant="success">فعال</Badge></p>
                <p className="text-muted-foreground">تا {formatDate(sub.endsAt!)}</p>
              </>
            ) : (
              <>
                <p className="font-semibold">اشتراک فعالی ندارید.</p>
                <p className="text-muted-foreground">{t.plansNote}</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Gamepad className="size-5" /> تست دسته</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {gamepad ? <Badge variant="success">دسترسی فعال</Badge> : <Badge variant="outline"><Lock className="size-3" /> نیازمند اشتراک فعال</Badge>}
            <p className="text-muted-foreground">ابزار تست دسته به‌زودی فعال می‌شود.</p>
            <Link href="/tournaments/gamepad-tester" className="text-link underline underline-offset-4">صفحهٔ تست دسته</Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Trophy className="size-5" /> تورنومنت‌ها</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">همکاری در برگزاری تورنومنت‌ها به‌زودی از همین پنل امکان‌پذیر می‌شود.</CardContent>
        </Card>
      </div>

      <section className="space-y-3" aria-labelledby="plans-title">
        <h2 id="plans-title" className="text-xl font-bold">{t.plansTitle}</h2>
        <PlanCards plans={plans} note={t.plansNote} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>اطلاعات کسب‌وکار</CardTitle>
          <CardDescription>تأییدشده در {profile.reviewedAt ? formatDate(profile.reviewedAt) : "—"}</CardDescription>
        </CardHeader>
        <CardContent><PartnerForm initial={toFormValues(profile)} lockIdentity submitLabel="ذخیرهٔ اطلاعات" /></CardContent>
      </Card>
    </div>
  );
}
