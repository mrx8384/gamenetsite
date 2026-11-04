import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { TournamentEntryStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatDateTime, formatNumber, formatToman } from "@/lib/format";
import { RefundButton } from "./refund-button";

export const ENTRY_STATUS: Record<TournamentEntryStatus, [string, "success" | "warning" | "outline" | "secondary" | "destructive"]> = {
  AWAITING_PAYMENT: ["در انتظار پرداخت", "secondary"],
  PAID: ["پرداخت‌شده", "success"],
  CANCELLED: ["ناتمام", "outline"],
  REFUND_NEEDED: ["نیاز به بازپرداخت", "destructive"],
  REFUNDED: ["بازپرداخت شد", "outline"],
};

export interface EntryRow {
  id: string;
  name: string;
  amount: bigint;
  status: TournamentEntryStatus;
  isTest: boolean;
  note: string | null;
  paidAt: Date | null;
  tournamentName: string;
  user: { name: string; phone: string | null };
  payment: { referenceId: string | null } | null;
}

export const entrySelect = {
  id: true,
  name: true,
  amount: true,
  status: true,
  isTest: true,
  note: true,
  paidAt: true,
  tournamentName: true,
  user: { select: { name: true, phone: true } },
  payment: { select: { referenceId: true } },
} as const;

export function EntriesTable({ entries, isAdmin, showTournament = false }: { entries: EntryRow[]; isAdmin: boolean; showTournament?: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showTournament ? <TableHead>تورنومنت</TableHead> : null}
          <TableHead>بازیکن</TableHead>
          <TableHead>مبلغ</TableHead>
          <TableHead>وضعیت</TableHead>
          <TableHead>زمان پرداخت</TableHead>
          {isAdmin ? <TableHead><span className="sr-only">عملیات</span></TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((e) => (
          <TableRow key={e.id}>
            {showTournament ? <TableCell className="font-medium">{e.tournamentName}</TableCell> : null}
            <TableCell>
              <p className="font-medium">{e.name}</p>
              <p className="text-xs text-muted-foreground">{e.user.name}{e.user.phone ? <span className="ltr"> · {e.user.phone}</span> : null}</p>
            </TableCell>
            <TableCell className="whitespace-nowrap">{formatToman(e.amount)}</TableCell>
            <TableCell>
              <span className="inline-flex flex-wrap items-center gap-1">
                <Badge variant={ENTRY_STATUS[e.status][1]}>{ENTRY_STATUS[e.status][0]}</Badge>
                {e.isTest ? <Badge variant="outline">آزمایشی</Badge> : null}
              </span>
              {e.note && e.status === "REFUND_NEEDED" ? <p className="mt-1 text-xs text-muted-foreground">{e.note}</p> : null}
            </TableCell>
            <TableCell className="whitespace-nowrap text-xs">
              {e.paidAt ? formatDateTime(e.paidAt) : "—"}
              {e.payment?.referenceId ? <p className="ltr text-start text-muted-foreground">Ref: {e.payment.referenceId}</p> : null}
            </TableCell>
            {isAdmin ? <TableCell>{e.status === "REFUND_NEEDED" ? <RefundButton entryId={e.id} label={`${formatToman(e.amount)} برای «${e.name}»`} /> : null}</TableCell> : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Paid registrations of one tournament (organizer page). The money goes to the site's gateway account. */
export async function TournamentEntriesCard({ tournamentId, isAdmin }: { tournamentId: string; isAdmin: boolean }) {
  const entries = await db.tournamentEntry.findMany({
    where: { tournamentId, status: { in: ["PAID", "REFUND_NEEDED", "REFUNDED"] } },
    orderBy: { paidAt: "desc" },
    select: entrySelect,
  });
  if (entries.length === 0) return null;
  const paid = entries.filter((e) => e.status === "PAID");
  const total = paid.reduce((s, e) => s + e.amount, BigInt(0));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">پرداخت‌های ثبت‌نام</CardTitle>
        <p className="text-sm text-muted-foreground">
          {formatNumber(paid.length)} پرداخت موفق · جمع {formatToman(total)}. مبلغ‌ها به حساب درگاه اتم گیم کلاب واریز می‌شوند.
        </p>
      </CardHeader>
      <CardContent><EntriesTable entries={entries} isAdmin={isAdmin} /></CardContent>
    </Card>
  );
}
