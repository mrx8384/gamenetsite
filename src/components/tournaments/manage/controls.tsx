"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Ban, ExternalLink, Megaphone, Play, RotateCcw, Shuffle, Trash2, Undo2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import {
  addParticipant,
  deleteTournament,
  moveParticipant,
  removeParticipant,
  resetTournament,
  setTournamentStatus,
  shuffleParticipants,
  startTournament,
} from "@/features/tournaments/actions";
import type { TournamentStatusKey } from "@/features/tournaments/constants";
import type { ActionResult } from "@/lib/action-result";

function useAction() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const run = (fn: () => Promise<ActionResult<unknown>>, after?: () => void) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      if (res.message) toast.success(res.message);
      after?.();
      router.refresh();
    });
  return { pending, run, router };
}

type Confirm = { title: string; description: string; label: string; destructive?: boolean; fn: () => Promise<ActionResult<unknown>>; after?: () => void };

export function StatusControls({ id, slug, status, participantCount, basePath }: { id: string; slug: string; status: TournamentStatusKey; participantCount: number; basePath: string }) {
  const { pending, run, router } = useAction();
  const [confirm, setConfirm] = React.useState<Confirm | null>(null);
  const started = status === "IN_PROGRESS" || status === "COMPLETED";
  return (
    <div className="flex flex-wrap gap-2">
      {status === "DRAFT" || status === "CANCELLED" ? (
        <Button loading={pending} onClick={() => run(() => setTournamentStatus(id, "REGISTRATION"))}><Megaphone /> انتشار و باز کردن ثبت‌نام</Button>
      ) : null}
      {status === "DRAFT" || status === "REGISTRATION" ? (
        <Button
          variant={status === "REGISTRATION" ? "default" : "outline"}
          disabled={participantCount < 2}
          onClick={() => setConfirm({ title: "شروع تورنومنت؟", description: "ثبت‌نام بسته و جدول بازی‌ها بر اساس ترتیب فعلی شرکت‌کنندگان ساخته می‌شود. فهرست شرکت‌کنندگان بعد از شروع قفل است.", label: "شروع و ساخت جدول", fn: () => startTournament(id) })}
        >
          <Play /> شروع تورنومنت
        </Button>
      ) : null}
      {status === "REGISTRATION" ? (
        <Button variant="outline" loading={pending} onClick={() => run(() => setTournamentStatus(id, "DRAFT"))}><Undo2 /> بازگشت به پیش‌نویس</Button>
      ) : null}
      {started ? (
        <Button variant="outline" onClick={() => setConfirm({ title: "بازنشانی جدول؟", description: "همهٔ بازی‌ها و نتایج پاک می‌شود و تورنومنت به مرحلهٔ ثبت‌نام برمی‌گردد. شرکت‌کنندگان حفظ می‌شوند.", label: "بله، بازنشانی شود", destructive: true, fn: () => resetTournament(id) })}>
          <RotateCcw /> بازنشانی جدول
        </Button>
      ) : null}
      {status !== "CANCELLED" && status !== "COMPLETED" ? (
        <Button variant="outline" className="text-destructive" onClick={() => setConfirm({ title: "لغو تورنومنت؟", description: "تورنومنت با برچسب «لغوشده» نمایش داده می‌شود.", label: "لغو تورنومنت", destructive: true, fn: () => setTournamentStatus(id, "CANCELLED") })}>
          <Ban /> لغو
        </Button>
      ) : null}
      <Button variant="outline" className="text-destructive" onClick={() => setConfirm({ title: "حذف کامل تورنومنت؟", description: "تورنومنت، شرکت‌کنندگان و همهٔ نتایج برای همیشه حذف می‌شود.", label: "حذف", destructive: true, fn: () => deleteTournament(id), after: () => router.push(basePath) })}>
        <Trash2 /> حذف
      </Button>
      {status !== "DRAFT" ? (
        <Button asChild variant="ghost"><Link href={`/tournaments/${slug}`} target="_blank"><ExternalLink /> مشاهده در سایت</Link></Button>
      ) : null}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive={confirm?.destructive}
        title={confirm?.title ?? ""}
        description={confirm?.description}
        confirmLabel={confirm?.label}
        onConfirm={async () => {
          if (!confirm) return;
          const res = await confirm.fn();
          if (!res.ok) return void toast.error(res.error);
          if (res.message) toast.success(res.message);
          confirm.after?.();
          router.refresh();
        }}
      />
    </div>
  );
}

export function ParticipantsManager({ tournamentId, participants, editable, max }: { tournamentId: string; participants: { id: string; name: string; seed: number; userId: string | null; finalRank: number | null }[]; editable: boolean; max: number | null }) {
  const { pending, run } = useAction();
  const [name, setName] = React.useState("");
  const fa = (n: number) => n.toLocaleString("fa-IR");
  return (
    <div className="space-y-4">
      {editable ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => addParticipant(tournamentId, name), () => setName(""));
          }}
        >
          <Input aria-label="نام شرکت‌کننده" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="نام بازیکن (ثبت‌نام حضوری)" />
          <Button type="submit" variant="strong" disabled={!name.trim() || pending}><UserPlus /> افزودن</Button>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">بعد از شروع تورنومنت، فهرست شرکت‌کنندگان قفل است.</p>
      )}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{fa(participants.length)}{max ? ` از ${fa(max)}` : ""} نفر — ترتیب فهرست همان سیدبندی است.</span>
        {editable && participants.length > 1 ? <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => shuffleParticipants(tournamentId))}><Shuffle /> ترتیب تصادفی</Button> : null}
      </div>
      {participants.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">هنوز کسی ثبت‌نام نکرده است.</p>
      ) : (
        <ol className="divide-y rounded-xl border">
          {participants.map((p, i) => (
            <li key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="w-7 text-muted-foreground">{fa(p.seed)}</span>
              <span className="flex-1 truncate font-medium">{p.name}</span>
              {p.userId ? <span className="text-xs text-success">ثبت‌نام آنلاین</span> : <span className="text-xs text-muted-foreground">دستی</span>}
              {p.finalRank ? <span className="text-xs font-bold">رتبهٔ {fa(p.finalRank)}</span> : null}
              {editable ? (
                <span className="flex">
                  <Button variant="ghost" size="icon-sm" aria-label={`بالا بردن ${p.name}`} disabled={pending || i === 0} onClick={() => run(() => moveParticipant(p.id, "up"))}><ArrowUp /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`پایین بردن ${p.name}`} disabled={pending || i === participants.length - 1} onClick={() => run(() => moveParticipant(p.id, "down"))}><ArrowDown /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`حذف ${p.name}`} className="text-destructive" disabled={pending} onClick={() => run(() => removeParticipant(p.id))}><X /></Button>
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
