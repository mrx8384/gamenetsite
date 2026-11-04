import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { EntriesTable, entrySelect } from "@/components/tournaments/manage/entries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, LoadingRows } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatNumber, formatToman } from "@/lib/format";
import { Ticket } from "lucide-react";

export const metadata: Metadata = { title: "پرداخت‌های تورنومنت" };

export default function TournamentPaymentsPage() {
  return (
    <>
      <Link href="/admin/tournaments" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronRight className="size-4" /> تورنومنت‌ها</Link>
      <AdminPageHeader title="پرداخت‌های تورنومنت" description="هزینه‌های ثبت‌نام آنلاین همهٔ تورنومنت‌ها (اتم و همکاران). مبلغ‌ها به حساب درگاه سایت واریز می‌شوند؛ سهم همکاران را از جدول «جمع برای هر برگزارکننده» تسویه کنید." />
      <Suspense fallback={<LoadingRows rows={6} />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  await requireRole(["ADMIN"], "/admin/tournaments/payments");
  const entries = await db.tournamentEntry.findMany({
    where: { status: { in: ["PAID", "REFUND_NEEDED", "REFUNDED"] } },
    orderBy: [{ paidAt: "desc" }],
    take: 300,
    select: { ...entrySelect, tournament: { select: { organizer: { select: { id: true, name: true, role: true, partnerProfile: { select: { businessName: true } } } } } } },
  });
  if (entries.length === 0) return <EmptyState icon={Ticket} title="هنوز پرداختی نیست" description="وقتی برای تورنومنتی «هزینهٔ ثبت‌نام آنلاین» بگذارید و بازیکنان پرداخت کنند، این‌جا دیده می‌شود." />;

  const refunds = entries.filter((e) => e.status === "REFUND_NEEDED");
  const byOrganizer = new Map<string, { name: string; count: number; total: bigint }>();
  for (const e of entries) {
    if (e.status !== "PAID" || e.isTest) continue;
    const o = e.tournament?.organizer;
    const key = o && o.role === "PARTNER" ? o.id : "atom";
    const name = o && o.role === "PARTNER" ? (o.partnerProfile?.businessName ?? o.name) : "اتم گیم کلاب";
    const row = byOrganizer.get(key) ?? { name, count: 0, total: BigInt(0) };
    row.count += 1;
    row.total += e.amount;
    byOrganizer.set(key, row);
  }

  return (
    <div className="space-y-6">
      {refunds.length ? (
        <Card className="border-destructive/40">
          <CardHeader><CardTitle className="text-base">نیاز به بازپرداخت ({formatNumber(refunds.length)})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">این بازیکنان پول داده‌اند ولی در تورنومنت نیستند (ظرفیت پر شد، تورنومنت لغو/حذف شد یا برگزارکننده حذفشان کرد). مبلغ را برگردانید و «بازپرداخت شد» را بزنید.</p>
            <EntriesTable entries={refunds} isAdmin showTournament />
          </CardContent>
        </Card>
      ) : null}
      {byOrganizer.size ? (
        <Card>
          <CardHeader><CardTitle className="text-base">جمع برای هر برگزارکننده</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>برگزارکننده</TableHead><TableHead>تعداد پرداخت</TableHead><TableHead>جمع</TableHead></TableRow></TableHeader>
              <TableBody>
                {[...byOrganizer.values()].map((r) => (
                  <TableRow key={r.name}><TableCell className="font-medium">{r.name}</TableCell><TableCell>{formatNumber(r.count)}</TableCell><TableCell className="whitespace-nowrap">{formatToman(r.total)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-2 text-xs text-muted-foreground">بدون پرداخت‌های آزمایشی و بازگردانده‌شده.</p>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader><CardTitle className="text-base">همهٔ پرداخت‌ها</CardTitle></CardHeader>
        <CardContent><EntriesTable entries={entries} isAdmin={false} showTournament /></CardContent>
      </Card>
    </div>
  );
}
