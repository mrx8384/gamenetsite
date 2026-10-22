import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Handshake, Search } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { AdminPageHeader } from "@/components/admin/page-header";
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
      <AdminPageHeader title="همکاران" description="بررسی درخواست‌های همکاری، تأیید، رد و تعلیق همکاران." />
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
  const [counts, total, partners] = await Promise.all([
    db.partnerProfile.groupBy({ by: ["status"], _count: true }),
    db.partnerProfile.count({ where }),
    db.partnerProfile.findMany({
      where,
      orderBy: status === "PENDING" ? { submittedAt: "asc" } : { updatedAt: "desc" }, // oldest pending first
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, businessName: true, businessType: true, city: true, province: true, status: true, submittedAt: true, user: { select: { name: true, phone: true, email: true } } },
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>کسب‌وکار</TableHead>
              <TableHead>نوع</TableHead>
              <TableHead>شهر</TableHead>
              <TableHead>کاربر</TableHead>
              <TableHead>تاریخ درخواست</TableHead>
              <TableHead>وضعیت</TableHead>
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
                <TableCell><PartnerStatusBadge status={p.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
