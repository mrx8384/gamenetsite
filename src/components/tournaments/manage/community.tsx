"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Code2, Copy, Download, Pencil, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addCoOrganizer, removeCoOrganizer, removeFromWaitlist, updateParticipant } from "@/features/tournaments/community-actions";
import { admitReserve, replaceWithReserve, setLiveNotice } from "@/features/tournaments/actions";
import type { TournamentPrivate } from "@/features/tournaments/queries";
import type { ActionResult } from "@/lib/action-result";

const fa = (n: number) => n.toLocaleString("fa-IR");

function useRun() {
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
  return { pending, run };
}

/** Owner adds people (by their account's email or mobile) who may run the tournament with them. */
export function CoOrganizersCard({ tournamentId, list }: { tournamentId: string; list: TournamentPrivate["coOrganizers"] }) {
  const { pending, run } = useRun();
  const [contact, setContact] = React.useState("");
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">همکاران برگزاری</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs leading-6 text-muted-foreground">
          این افراد از «حساب کاربری ← تورنومنت‌های من» نتایج را ثبت می‌کنند، شرکت‌کنندگان و چک‌این را مدیریت می‌کنند و تورنومنت را شروع یا بازنشانی می‌کنند. تنظیمات، انتشار، لغو و حذف فقط با شماست.
        </p>
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); run(() => addCoOrganizer(tournamentId, contact), () => setContact("")); }}>
          <Input aria-label="ایمیل یا موبایل همکار" dir="ltr" className="min-w-0 flex-1 text-start" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="email@example.com / 0912…" />
          <Button type="submit" variant="strong" disabled={!contact.trim() || pending}><UserPlus /> افزودن</Button>
        </form>
        {list.length ? (
          <ul className="divide-y rounded-xl border">
            {list.map((c) => (
              <li key={c.userId} className="flex items-center gap-2 px-3 py-2 text-sm">
                <span className="flex-1 truncate font-medium">{c.name}</span>
                <span className="ltr truncate text-xs text-muted-foreground">{c.contact}</span>
                <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label={`حذف ${c.name}`} disabled={pending} onClick={() => run(() => removeCoOrganizer(tournamentId, c.userId))}><X /></Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">هنوز همکاری اضافه نشده است.</p>
        )}
      </CardContent>
    </Card>
  );
}

export function WaitlistCard({ list, enabled, isFree }: { list: TournamentPrivate["waitlist"]; enabled: boolean; isFree: boolean }) {
  const { pending, run } = useRun();
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">لیست انتظار {list.length ? `(${fa(list.length)})` : ""}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs leading-6 text-muted-foreground">
          {!isFree
            ? "لیست انتظار فقط برای تورنومنت‌های رایگان است (در تورنومنت پولی، با خالی شدن جا هر کس زودتر پرداخت کند وارد می‌شود)."
            : enabled
              ? "وقتی ظرفیت پر است، ثبت‌نام‌های جدید به این لیست می‌روند. با انصراف یا حذف یک نفر، یا با بیشتر کردن ظرفیت، نفر اول لیست خودکار اضافه می‌شود. با شروع تورنومنت لیست پاک می‌شود."
              : "لیست انتظار خاموش است؛ با پر شدن ظرفیت، ثبت‌نام بسته می‌شود."}
        </p>
        {list.length ? (
          <ol className="divide-y rounded-xl border">
            {list.map((w, i) => (
              <li key={w.id} className="flex items-start gap-2 px-3 py-2 text-sm">
                <span className="w-6 text-muted-foreground">{fa(i + 1)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{w.name}</p>
                  {w.members.length ? <p className="text-xs text-muted-foreground">اعضا: {w.members.join("، ")}</p> : null}
                  <Answers answers={w.answers} />
                </div>
                <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label={`حذف ${w.name} از لیست انتظار`} disabled={pending} onClick={() => run(() => removeFromWaitlist(w.id))}><Trash2 /></Button>
              </li>
            ))}
          </ol>
        ) : enabled && isFree ? (
          <p className="text-sm text-muted-foreground">کسی در لیست انتظار نیست.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function Answers({ answers }: { answers: { q: string; a: string }[] | undefined }) {
  if (!answers?.length) return null;
  return (
    <dl className="mt-1 space-y-0.5 text-xs">
      {answers.map((x, i) => (
        <div key={i} className="flex gap-1">
          <dt className="text-muted-foreground">{x.q}:</dt>
          <dd className="min-w-0 break-words font-medium">{x.a}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Rename a participant / team and edit the team members. */
type Question = { label: string; required: boolean };

export function EditParticipantButton({ participant, teamSize, questions = [], answers = [] }: { participant: { id: string; name: string; members: string[] }; teamSize: number | null; questions?: Question[]; answers?: { q: string; a: string }[] }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label={`ویرایش ${participant.name}`} onClick={() => setOpen(true)}><Pencil /></Button>
      {open ? <EditParticipantDialog participant={participant} teamSize={teamSize} questions={questions} answers={answers} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function EditParticipantDialog({ participant, teamSize, questions, answers, onClose }: { participant: { id: string; name: string; members: string[] }; teamSize: number | null; questions: Question[]; answers: { q: string; a: string }[]; onClose: () => void }) {
  const { pending, run } = useRun();
  const [name, setName] = React.useState(participant.name);
  const [members, setMembers] = React.useState(participant.members.join("\n"));
  const [values, setValues] = React.useState(() => questions.map((q) => answers.find((x) => x.q === q.label)?.a ?? ""));
  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>ویرایش شرکت‌کننده</DialogTitle>
          <DialogDescription>{teamSize ? `تیمی — ${fa(teamSize)} نفره (سرگروه + ${fa(teamSize - 1)} عضو)` : "انفرادی"}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => updateParticipant(participant.id, { name, members: members.split("\n").map((m) => m.trim()).filter(Boolean), ...(questions.length ? { answers: values } : {}) }), onClose);
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="ep-name">{teamSize ? "نام تیم" : "نام"}</Label>
            <Input id="ep-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ep-members">اعضای تیم (هر نام در یک خط، اختیاری)</Label>
            <Textarea id="ep-members" rows={4} value={members} onChange={(e) => setMembers(e.target.value)} />
          </div>
          {questions.map((q, i) => (
            <div key={q.label} className="grid gap-1.5">
              <Label htmlFor={`ep-q-${i}`}>{q.label}{q.required ? " *" : " (اختیاری)"}</Label>
              <Input id={`ep-q-${i}`} value={values[i] ?? ""} maxLength={500} onChange={(e) => setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))} />
            </div>
          ))}
          <DialogFooter><Button type="submit" loading={pending}>ذخیره</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Excel (CSV) downloads and the embed code for other websites. */
export function ShareCard({ tournamentId, slug, published, origin }: { tournamentId: string; slug: string; published: boolean; origin: string }) {
  const embed = `<iframe src="${origin}/embed/tournaments/${encodeURIComponent(slug)}" width="100%" height="600" style="border:0" loading="lazy" title="جدول تورنومنت"></iframe>`;
  const copy = () =>
    navigator.clipboard.writeText(embed).then(
      () => toast.success("کد کپی شد."),
      () => toast.error("کپی نشد؛ کد را دستی انتخاب کنید."),
    );
  const files = [
    ["participants", "شرکت‌کنندگان (با پاسخ‌ها)"],
    ["matches", "بازی‌ها و نتایج"],
    ["standings", "رتبه‌ها"],
  ] as const;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">خروجی اکسل و نمایش در سایت‌های دیگر</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {files.map(([kind, label]) => (
            <Button key={kind} asChild variant="outline" size="sm">
              <a href={`/api/tournaments/${tournamentId}/export?kind=${kind}`} download><Download /> {label}</a>
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">فایل‌ها CSV هستند و مستقیم در اکسل با حروف فارسی باز می‌شوند.</p>
        {published ? (
          <div className="space-y-2">
            <Label htmlFor="embed-code" className="flex items-center gap-1"><Code2 className="size-4" /> کد نمایش جدول در سایت یا وبلاگ دیگر</Label>
            <Textarea id="embed-code" readOnly dir="ltr" rows={3} value={embed} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <Button type="button" variant="outline" size="sm" onClick={copy}><Copy /> کپی کد</Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">کد نمایش بعد از انتشار تورنومنت در دسترس است.</p>
        )}
      </CardContent>
    </Card>
  );
}

/** Paid reserves: put one in the place of a player who dropped out, or add one while there is room. */
export function ReserveCard({ reserves, participants, canAdmit, enabled }: { reserves: TournamentPrivate["reserves"]; participants: { id: string; name: string }[]; canAdmit: boolean; enabled: boolean }) {
  const { pending, run } = useRun();
  const [target, setTarget] = React.useState<Record<string, string>>({});
  const fmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran", dateStyle: "medium", timeStyle: "short" });
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">لیست رزرو با پرداخت {reserves.length ? `(${fa(reserves.length)})` : ""}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs leading-6 text-muted-foreground">
          {enabled ? "رزرو باز است: وقتی ظرفیت پر است (و در طول تورنومنت) افراد با پرداخت هزینهٔ ثبت‌نام اینجا اضافه می‌شوند." : "لیست رزرو بسته است (در تنظیمات یا هنگام شروع قابل فعال‌سازی)."} اگر بازیکنی کنار رفت، رزرو را جای او بگذارید؛ جایگاه او در جدول حفظ می‌شود. رزروهای استفاده‌نشده با پایان تورنومنت در صفحهٔ پرداخت‌ها «نیاز به بازپرداخت» می‌شوند.
        </p>
        {reserves.length === 0 ? (
          <p className="text-sm text-muted-foreground">هنوز کسی رزرو نکرده است.</p>
        ) : (
          <ol className="divide-y rounded-xl border">
            {reserves.map((r, i) => (
              <li key={r.id} className="space-y-2 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-start gap-2">
                  <span className="w-6 text-muted-foreground">{fa(i + 1)}</span>
                  <div className="min-w-40 flex-1">
                    <p className="font-medium">{r.name}</p>
                    {r.phone ? <p className="ltr text-start text-xs text-muted-foreground">{r.phone}</p> : null}
                    {r.members.length ? <p className="text-xs text-muted-foreground">اعضا: {r.members.join("، ")}</p> : null}
                    <Answers answers={r.answers} />
                  </div>
                  <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">پرداخت‌شده{r.paidAt ? ` · ${fmt.format(new Date(r.paidAt))}` : ""}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label={`بازیکنی که ${r.name} جایش را می‌گیرد`}
                    value={target[r.id] ?? ""}
                    onChange={(e) => setTarget((t) => ({ ...t, [r.id]: e.target.value }))}
                    className="h-9 min-w-0 flex-1 rounded-lg border bg-surface px-2 text-sm"
                  >
                    <option value="">جای کدام بازیکن؟</option>
                    {participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <Button type="button" size="sm" disabled={pending || !target[r.id]} onClick={() => run(() => replaceWithReserve(r.id, target[r.id]))}>جایگزین کن</Button>
                  {canAdmit ? <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run(() => admitReserve(r.id))}>افزودن به شرکت‌کنندگان</Button> : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

/** Live link for viewers (groups, qualifiers, bracket, results update by themselves) and its notice. */
export function LiveCard({ tournamentId, url, notice }: { tournamentId: string; url: string; notice: string | null }) {
  const { pending, run } = useRun();
  const [text, setText] = React.useState(notice ?? "");
  const copy = () => navigator.clipboard.writeText(url).then(() => toast.success("لینک کپی شد."), () => toast.error("کپی نشد؛ دستی انتخاب کنید."));
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><span className="size-2 animate-pulse rounded-full bg-brand-green" aria-hidden /> لینک لایو تورنومنت</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs leading-6 text-muted-foreground">این لینک را برای بازیکنان و تماشاچیان بفرستید (مثلاً در گروه). جدول گروه‌ها، صعودکننده‌ها، جدول حذفی و نتایج هر چند ثانیه خودکار به‌روز می‌شود؛ هر نتیجه‌ای که ثبت کنید همان‌جا دیده می‌شود. در صفحهٔ تورنومنت هم دکمه‌اش برای همه نمایش داده می‌شود.</p>
        <div className="flex flex-wrap gap-2">
          <Input readOnly dir="ltr" value={url} className="min-w-0 flex-1 text-start font-mono text-xs" onFocus={(e) => e.currentTarget.select()} aria-label="لینک لایو" />
          <Button type="button" variant="outline" size="sm" onClick={copy}><Copy /> کپی</Button>
          <Button asChild size="sm" variant="outline"><a href={url} target="_blank" rel="noopener">باز کردن</a></Button>
        </div>
        <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); run(() => setLiveNotice(tournamentId, text)); }}>
          <Label htmlFor="live-notice">اطلاعیهٔ بالای صفحهٔ لایو (اختیاری)</Label>
          <Textarea id="live-notice" rows={2} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder="مثلاً: بازی‌های گروه A تمام شد؛ مرحلهٔ حذفی ساعت ۱۸ شروع می‌شود." />
          <Button type="submit" size="sm" variant="outline" className="justify-self-start" loading={pending}>ذخیرهٔ اطلاعیه</Button>
        </form>
      </CardContent>
    </Card>
  );
}
