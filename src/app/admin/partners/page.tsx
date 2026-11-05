import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Gamepad2, Handshake, Search } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { PartnerStatusBadge } from "@/components/partners/partner-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, LoadingRows } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BUSINESS_TYPE_LABELS, PARTNER_STATUS_LABELS, type PartnerStatusKey } from "@/features/partners/constants";
import { requireRole } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDateTime, formatNumber, toEnglishDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "همکاران" };
const PAGE_SIZE = 30;
const STATUSES: PartnerStatusKey[] = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"];

type SP = { status?: string; q?: string; page?: string };

export default function PartnersAdminPage({ searchParams }: PageProps<"/admin/partners">) {
  return (
    <>
      <AdminPageHeader
        title="همکاران"
        description="بررسی درخواست‌های همکاری، تأیید، رد و تعلیق همکاران."
        actions={<Button asChild variant="outline"><Link href="/partner/gamepad-tester"><Gamepad2 /> تست دسته</Link></Button>}
      />
      <Suspense fallback={<LoadingRows rows={6} />}>
        <PartnerList searchParams={searchParams as Promise<SP>} />
      </Suspense>
    </>
  );
}

async function PartnerList({ searchParams }: { searchParams: Promise<SP> }) {
  await requireRole(["ADMIN"], "/admin/partners");
  const sp = await searchParams;
  const status: PartnerStatusKey = STATUSES.includes(sp.status as PartnerStatusKey) ? (sp.status as PartnerStatusKey) : "PENDING";
  const q = toEnglishDigits(String(sp.q ?? "")).trim().slice(0, 100);
  const page = Math.max(1, Number.parseInt(String(sp.page ?? "1"), 10) || 1);
  const where: Prisma.PartnerProfileWhereInput = {
    status,
    ...(q
      ? {
          OR: [
            { businessName: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
            { user: { phone: { contains: q } } },
            { user: { email: { contains: q.toLowerCase() } } },
            { user: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [logoQueue, counts, total, partners] = await Promise.all([
    db.partnerProfile.findMany({ where: { pendingLogoId: { not: null } }, orderBy: { logoSubmittedAt: "asc" }, take: 20, select: { id: true, businessName: true } }),
    db.partnerProfile.groupBy({ by: ["status"], _count: true }),
    db.partnerProfile.count({ where }),
    db.partnerProfile.findMany({
      where,
      orderBy: status === "PENDING" ? { submittedAt: "asc" } : { updatedAt: "desc" }, // oldest pending first
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, businessName: true, businessType: true, city: true, province: true, status: true, submittedAt: true, pendingLogoId: true, showPartnerPrices: true, user: { select: { name: true, phone: true, email: true } } },
    }),
  ]);
  const count = (s: PartnerStatusKey) => counts.find((c) => c.status === s)?._count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (patch: Partial<SP>) => {
    const p = new URLSearchParams();
    const n = { status, q, page: "1", ...patch };
    if (n.status !== "PENDING") p.set("status", n.status);
    if (n.q) p.set("q", n.q);
    if (n.page && n.page !== "1") p.set("page", n.page);
    const s = p.toString();
    return s ? `/admin/partners?${s}` : "/admin/partners";
  };

  return (
    <div className="space-y-4">
      {logoQueue.length ? (
        <div className="rounded-xl border border-warning/40 bg-warning-soft p-4 text-sm">
          <p className="mb-2 font-semibold">لوگوی جدید در انتظار تأیید ({formatNumber(logoQueue.length)})</p>
          <div className="flex flex-wrap gap-2">
            {logoQueue.map((l) => (
              <Link key={l.id} href={`/admin/partners/${l.id}`} className="rounded-full border bg-surface px-3 py-1 text-link hover:underline">{l.businessName}</Link>
            ))}
          </div>
        </div>
      ) : null}
      <nav className="flex flex-wrap gap-2" aria-label="وضعیت">
        {STATUSES.map((s) => (
          <Link key={s} href={link({ status: s, page: "1" })} aria-current={status === s ? "page" : undefined}
            className={cn("rounded-full border px-4 py-1.5 text-sm", status === s ? "border-brand-green bg-brand-green/10 font-semibold" : "bg-surface hover:bg-secondary")}>
            {PARTNER_STATUS_LABELS[s]} ({formatNumber(count(s))})
          </Link>
        ))}
      </nav>
      <form className="flex max-w-md gap-2" action="/admin/partners">
        {status !== "PENDING" ? <input type="hidden" name="status" value={status} /> : null}
        <Input name="q" defaultValue={q} placeholder="نام کسب‌وکار، شهر، موبایل یا ایمیل" aria-label="جستجو" />
        <Button type="submit" variant="outline"><Search /> جستجو</Button>
      </form>
      {partners.length === 0 ? (
        <EmptyState icon={Handshake} title={q ? "نتیجه‌ای پیدا نشد" : `همکاری با وضعیت «${PARTNER_STATUS_LABELS[status]}» نیست`} />
      ) : (
        <>
        {/* Phones: cards with the review button in view (the table scrolls sideways there). */}
        <ul className="grid gap-3 md:hidden">
          {partners.map((p) => (
            <li key={p.id} className="space-y-3 rounded-xl border bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/admin/partners/${p.id}`} className="font-bold text-link hover:underline">{p.businessName}</Link>
                <PartnerStatusBadge status={p.status} />
                {p.pendingLogoId ? <Badge variant="warning">لوگوی جدید</Badge> : null}
              </div>
              <p className="text-sm text-muted-foreground">{BUSINESS_TYPE_LABELS[p.businessType]} · {p.city}، {p.province}</p>
              <p className="text-sm">{p.user.name} <span className="ltr inline-block text-xs text-muted-foreground">{p.user.phone ?? p.user.email}</span></p>
              <p className="text-xs text-muted-foreground">{formatDateTime(p.submittedAt)}</p>
              <Button asChild size="sm" variant={p.status === "PENDING" ? "default" : "outline"} className="w-full">
                <Link href={`/admin/partners/${p.id}`}>{p.status === "PENDING" ? "بررسی و تأیید / رد" : "مشاهده و مدیریت"}</Link>
              </Button>
            </li>
          ))}
        </ul>
        <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>کسب‌وکار</TableHead>
              <TableHead>نوع</TableHead>
              <TableHead>شهر</TableHead>
              <TableHead>کاربر</TableHead>
              <TableHead>تاریخ درخواست</TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead><span className="sr-only">عملیات</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {partners.map((p) => (
              <TableRow key={p.id}>
                <TableCell><Link href={`/admin/partners/${p.id}`} className="font-medium text-link hover:underline">{p.businessName}</Link></TableCell>
                <TableCell>{BUSINESS_TYPE_LABELS[p.businessType]}</TableCell>
                <TableCell>{p.city}، {p.province}</TableCell>
                <TableCell>
                  <p>{p.user.name}</p>
                  <p className="ltr text-start text-xs text-muted-foreground">{p.user.phone ?? p.user.email}</p>
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">{formatDateTime(p.submittedAt)}</TableCell>
                <TableCell><span className="inline-flex flex-wrap items-center gap-1"><PartnerStatusBadge status={p.status} />{p.pendingLogoId ? <Badge variant="warning">لوگوی جدید</Badge> : null}{p.showPartnerPrices && p.status === "APPROVED" ? <Badge variant="outline">قیمت همکار</Badge> : null}</span></TableCell>
                <TableCell>
                  {/* Approve / reject / suspend live on the detail page (reasons, subscription grant). */}
                  <Button asChild size="sm" variant={p.status === "PENDING" ? "default" : "outline"} className="whitespace-nowrap">
                    <Link href={`/admin/partners/${p.id}`}>{p.status === "PENDING" ? "بررسی و تأیید / رد" : "مشاهده و مدیریت"}</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
        </>
      )}
      {pages > 1 ? (
        <nav aria-label="صفحه‌بندی" className="flex justify-between text-sm">
          <span className="text-muted-foreground">صفحهٔ {formatNumber(page)} از {formatNumber(pages)}</span>
          <div className="flex gap-2">
            {page > 1 ? <Button asChild variant="outline" size="sm"><Link href={link({ page: String(page - 1) })}>قبلی</Link></Button> : null}
            {page < pages ? <Button asChild variant="outline" size="sm"><Link href={link({ page: String(page + 1) })}>بعدی</Link></Button> : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
