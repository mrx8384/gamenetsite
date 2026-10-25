import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Trophy } from "lucide-react";
import { TournamentBoard } from "@/components/tournaments/board";
import { ParticipantsManager, StatusControls } from "@/components/tournaments/manage/controls";
import { emptyTournament, TournamentForm, type TournamentFormValues } from "@/components/tournaments/manage/tournament-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FORMAT_LABELS, STATUS_BADGE, STATUS_LABELS } from "@/features/tournaments/constants";
import { canManageTournament } from "@/features/tournaments/permissions";
import { isoToTehranInput } from "@/features/tournaments/time";
import { getManagedTournaments, getTournamentForManage, type TournamentView } from "@/features/tournaments/queries";
import { formatDateTime, formatNumber } from "@/lib/format";

type Actor = { id: string; role: "ADMIN" | "USER" | "PARTNER" | "SUPPORT" };

export async function ManagedTournamentList({ user, basePath, canCreate }: { user: Actor; basePath: string; canCreate: boolean }) {
  const list = await getManagedTournaments(user);
  return (
    <div className="space-y-4">
      {canCreate ? (
        <Button asChild><Link href={`${basePath}/new`}><Plus /> تورنومنت جدید</Link></Button>
      ) : null}
      {list.length === 0 ? (
        <EmptyState icon={Trophy} title="هنوز تورنومنتی ساخته نشده" description={canCreate ? "اولین تورنومنت را بسازید." : undefined} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>نام</TableHead>
              <TableHead>نوع</TableHead>
              <TableHead>شرکت‌کنندگان</TableHead>
              <TableHead>شروع</TableHead>
              <TableHead>وضعیت</TableHead>
              {user.role === "ADMIN" ? <TableHead>برگزارکننده</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((t) => (
              <TableRow key={t.id}>
                <TableCell><Link href={`${basePath}/${t.id}`} className="font-medium text-link hover:underline">{t.name}</Link><p className="text-xs text-muted-foreground">{t.game}</p></TableCell>
                <TableCell className="text-sm">{FORMAT_LABELS[t.format]}</TableCell>
                <TableCell>{formatNumber(t._count.participants)}{t.maxParticipants ? ` / ${formatNumber(t.maxParticipants)}` : ""}</TableCell>
                <TableCell className="whitespace-nowrap text-sm">{t.startsAt ? formatDateTime(t.startsAt) : "—"}</TableCell>
                <TableCell><Badge variant={STATUS_BADGE[t.status]}>{STATUS_LABELS[t.status]}</Badge></TableCell>
                {user.role === "ADMIN" ? <TableCell className="text-sm">{t.organizer?.role === "PARTNER" ? (t.organizer.partnerProfile?.businessName ?? t.organizer.name) : "آتم"}</TableCell> : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export function NewTournament({ basePath }: { basePath: string }) {
  return (
    <Card>
      <CardHeader><CardTitle>تورنومنت جدید</CardTitle></CardHeader>
      <CardContent><TournamentForm initial={emptyTournament} basePath={basePath} /></CardContent>
    </Card>
  );
}

function formValues(t: TournamentView): TournamentFormValues {
  return {
    name: t.name,
    game: t.game,
    platform: t.platform ?? "",
    description: t.description ?? "",
    rules: t.rules ?? "",
    prize: t.prize ?? "",
    entryFeeNote: t.entryFeeNote ?? "",
    startsAtLocal: isoToTehranInput(t.startsAt),
    format: t.format,
    maxParticipants: t.maxParticipants?.toString() ?? "",
    allowSelfRegistration: t.allowSelfRegistration,
    thirdPlaceMatch: t.thirdPlaceMatch,
    doubleRoundRobin: t.doubleRoundRobin,
    groupCount: t.groupCount?.toString() ?? "",
    advancePerGroup: t.advancePerGroup?.toString() ?? "",
    pointsWin: String(t.pointsWin),
    pointsDraw: String(t.pointsDraw),
    pointsLoss: String(t.pointsLoss),
  };
}

export async function ManageTournament({ id, user, basePath }: { id: string; user: Actor; basePath: string }) {
  const t = await getTournamentForManage(id);
  if (!t || !canManageTournament(user, t)) notFound();
  const started = t.status === "IN_PROGRESS" || t.status === "COMPLETED";
  const editable = t.status === "DRAFT" || t.status === "REGISTRATION";
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-black">{t.name}</h1>
          <Badge variant={STATUS_BADGE[t.status]}>{STATUS_LABELS[t.status]}</Badge>
          <span className="text-sm text-muted-foreground">{FORMAT_LABELS[t.format]} · {t.game}</span>
        </div>
        <StatusControls id={t.id} slug={t.slug} status={t.status} participantCount={t.participants.length} basePath={basePath} />
        {t.status === "DRAFT" ? <p className="text-sm text-muted-foreground">پیش‌نویس در سایت نمایش داده نمی‌شود. با «انتشار» ثبت‌نام باز و تورنومنت در صفحهٔ تورنومنت‌ها دیده می‌شود.</p> : null}
      </div>
      {started ? (
        <section className="space-y-3" aria-labelledby="board-title">
          <h2 id="board-title" className="text-lg font-bold">جدول و نتایج</h2>
          <p className="text-sm text-muted-foreground">برای ثبت یا اصلاح نتیجه روی هر بازی کلیک کنید.</p>
          <TournamentBoard t={t} manage />
        </section>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader><CardTitle className="text-base">شرکت‌کنندگان</CardTitle></CardHeader>
          <CardContent><ParticipantsManager tournamentId={t.id} participants={t.participants} editable={editable} max={t.maxParticipants} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">تنظیمات</CardTitle></CardHeader>
          <CardContent><TournamentForm id={t.id} initial={formValues(t)} basePath={basePath} structureLocked={started} /></CardContent>
        </Card>
      </div>
    </div>
  );
}
