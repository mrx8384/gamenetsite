"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { JalaliDateTimeInput } from "@/components/ui/jalali-datetime-input";
import { Textarea } from "@/components/ui/textarea";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { createTournament, updateTournament } from "@/features/tournaments/actions";
import { Plus, X } from "lucide-react";
import { FORMAT_HINTS, FORMAT_LABELS, GRAND_FINAL_LABELS, GRAND_FINAL_MODES, MAX_SIGNUP_QUESTIONS, TIEBREAK_LABELS, TIEBREAKS, TOURNAMENT_FORMATS, type TournamentFormatKey } from "@/features/tournaments/constants";
import { tehranInputToIso } from "@/features/tournaments/time";
import { cn } from "@/lib/utils";

export interface TournamentFormValues {
  name: string;
  game: string;
  platform: string;
  description: string;
  rules: string;
  prize: string;
  entryFeeNote: string;
  /** Toman, digits only (empty = free). */
  entryFeeToman: string;
  startsAtLocal: string; // yyyy-MM-ddTHH:mm in Tehran time
  format: TournamentFormatKey;
  maxParticipants: string;
  /** Minutes before the start (empty = no check-in). */
  checkInMinutes: string;
  allowSelfRegistration: boolean;
  thirdPlaceMatch: boolean;
  doubleRoundRobin: boolean;
  groupCount: string;
  advancePerGroup: string;
  pointsWin: string;
  pointsDraw: string;
  pointsLoss: string;
  grandFinal: (typeof GRAND_FINAL_MODES)[number];
  tiebreak: (typeof TIEBREAKS)[number];
  /** Swiss rounds (empty = automatic). */
  swissRounds: string;
  /** Leaderboard rounds at the start. */
  leaderboardRounds: string;
  /** Players per team (empty = individual). */
  teamSize: string;
  signupQuestions: { label: string; required: boolean }[];
  allowPlayerReports: boolean;
  allowPredictions: boolean;
  waitlistEnabled: boolean;
}

export const emptyTournament: TournamentFormValues = {
  name: "",
  game: "EA SPORTS FC",
  platform: "PS5",
  description: "",
  rules: "",
  prize: "",
  entryFeeNote: "",
  entryFeeToman: "",
  startsAtLocal: "",
  format: "SINGLE_ELIMINATION",
  maxParticipants: "16",
  checkInMinutes: "",
  allowSelfRegistration: true,
  thirdPlaceMatch: true,
  doubleRoundRobin: false,
  groupCount: "4",
  advancePerGroup: "2",
  pointsWin: "3",
  pointsDraw: "1",
  pointsLoss: "0",
  grandFinal: "reset",
  tiebreak: "goal_difference",
  swissRounds: "",
  leaderboardRounds: "1",
  teamSize: "",
  signupQuestions: [],
  allowPlayerReports: false,
  allowPredictions: false,
  waitlistEnabled: true,
};

export function TournamentForm({ id, initial, basePath, structureLocked = false }: { id?: string; initial: TournamentFormValues; basePath: string; structureLocked?: boolean }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [v, setV] = React.useState(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();
  const set = <K extends keyof TournamentFormValues>(k: K, val: TournamentFormValues[K]) => setV((x) => ({ ...x, [k]: val }));
  const text = (k: keyof TournamentFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value as never);
  const err = (k: string) => (errors[k] ? <p role="alert" className="text-xs font-medium text-destructive">{errors[k]}</p> : null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const { startsAtLocal, ...rest } = v;
    const payload = { ...rest, startsAt: tehranInputToIso(startsAtLocal) };
    startTransition(async () => {
      const res = id ? await updateTournament(id, payload) : await createTournament(payload);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        return void toast.error(res.error);
      }
      setErrors({});
      toast.success(res.message);
      if (!id && res.data && "id" in res.data) router.push(`${basePath}/${(res.data as { id: string }).id}`);
      else router.refresh();
    });
  }

  return (
    <form onSubmit={submit} noValidate>
      <fieldset disabled={!hydrated || pending} className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="t-name">نام تورنومنت</Label>
            <Input id="t-name" value={v.name} onChange={text("name")} maxLength={120} placeholder="مثلاً جام هفتگی FC اتم" aria-invalid={!!errors.name} />
            {err("name")}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="t-game">بازی</Label>
            <Input id="t-game" value={v.game} onChange={text("game")} maxLength={80} aria-invalid={!!errors.game} />
            {err("game")}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="t-platform">کنسول (اختیاری)</Label>
            <Input id="t-platform" value={v.platform} onChange={text("platform")} maxLength={40} placeholder="PS5" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="t-start">زمان شروع — تقویم شمسی، به وقت ایران (اختیاری)</Label>
            <JalaliDateTimeInput id="t-start" value={v.startsAtLocal} onChange={(x) => set("startsAtLocal", x)} aria-invalid={!!errors.startsAt} />
            {err("startsAt")}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="t-max">ظرفیت (اختیاری)</Label>
            <Input id="t-max" inputMode="numeric" dir="ltr" className="text-start" value={v.maxParticipants} onChange={text("maxParticipants")} aria-invalid={!!errors.maxParticipants} />
            {err("maxParticipants")}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="t-checkin">چک‌این — دقیقه قبل از شروع (اختیاری)</Label>
            <Input id="t-checkin" inputMode="numeric" dir="ltr" className="text-start" value={v.checkInMinutes} onChange={text("checkInMinutes")} placeholder="مثلاً 30" aria-invalid={!!errors.checkInMinutes} aria-describedby="t-checkin-help" />
            <p id="t-checkin-help" className="text-xs leading-5 text-muted-foreground">اگر بگذارید، بازیکنان باید در این بازه حضورشان را تأیید کنند؛ موقع شروع، کسانی که تأیید نکرده‌اند حذف می‌شوند. شما هم می‌توانید برای هر نفر دستی تأیید کنید.</p>
            {err("checkInMinutes")}
          </div>
        </div>

        <fieldset className="grid gap-2" disabled={structureLocked}>
          <legend className="mb-1 text-sm font-medium">نوع تورنومنت{structureLocked ? " (بعد از شروع قفل است)" : ""}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {TOURNAMENT_FORMATS.map((f) => (
              <label key={f} className={cn("flex cursor-pointer gap-3 rounded-xl border p-3 text-sm", v.format === f && "border-brand-green ring-2 ring-brand-green/25")}>
                <input type="radio" name="t-format" checked={v.format === f} onChange={() => set("format", f)} className="mt-1 size-4 accent-[var(--brand-green-dark)]" />
                <span>
                  <span className="font-semibold">{FORMAT_LABELS[f]}</span>
                  <span className="block text-xs text-muted-foreground">{FORMAT_HINTS[f]}</span>
                </span>
              </label>
            ))}
          </div>
          {err("format")}
          <div className="grid gap-3 rounded-xl bg-secondary/50 p-3 sm:grid-cols-2">
            {v.format === "SINGLE_ELIMINATION" || v.format === "GROUPS_KNOCKOUT" ? (
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.thirdPlaceMatch} onChange={(e) => set("thirdPlaceMatch", e.target.checked)} className="size-4 accent-[var(--brand-green-dark)]" /> بازی رده‌بندی (مقام سوم)</label>
            ) : null}
            {v.format === "ROUND_ROBIN" || v.format === "GROUPS_KNOCKOUT" ? (
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.doubleRoundRobin} onChange={(e) => set("doubleRoundRobin", e.target.checked)} className="size-4 accent-[var(--brand-green-dark)]" /> رفت و برگشت</label>
            ) : null}
            {v.format === "GROUPS_KNOCKOUT" ? (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="t-groups">تعداد گروه‌ها</Label>
                  <Input id="t-groups" inputMode="numeric" dir="ltr" className="text-start" value={v.groupCount} onChange={text("groupCount")} aria-invalid={!!errors.groupCount} />
                  {err("groupCount")}
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="t-adv">صعود از هر گروه</Label>
                  <Input id="t-adv" inputMode="numeric" dir="ltr" className="text-start" value={v.advancePerGroup} onChange={text("advancePerGroup")} aria-invalid={!!errors.advancePerGroup} />
                  {err("advancePerGroup")}
                </div>
              </>
            ) : null}
            {v.format === "SWISS" ? (
              <div className="grid gap-1.5">
                <Label htmlFor="t-swiss">تعداد دورها (خالی = خودکار)</Label>
                <Input id="t-swiss" inputMode="numeric" dir="ltr" className="text-start" value={v.swissRounds} onChange={text("swissRounds")} placeholder="auto" aria-invalid={!!errors.swissRounds} aria-describedby="t-swiss-help" />
                <p id="t-swiss-help" className="text-xs leading-5 text-muted-foreground">خودکار: به اندازه‌ای که یک قهرمان مشخص شود (مثلاً ۱۶ نفر = ۴ دور). اگر تعداد فرد باشد، هر دور یک نفر استراحت (برد خودکار) می‌گیرد.</p>
                {err("swissRounds")}
              </div>
            ) : null}
            {v.format === "LEADERBOARD" ? (
              <div className="grid gap-1.5">
                <Label htmlFor="t-lb">تعداد دور/مسابقه در شروع</Label>
                <Input id="t-lb" inputMode="numeric" dir="ltr" className="text-start" value={v.leaderboardRounds} onChange={text("leaderboardRounds")} aria-invalid={!!errors.leaderboardRounds} aria-describedby="t-lb-help" />
                <p id="t-lb-help" className="text-xs leading-5 text-muted-foreground">بعداً هم می‌توانید دور اضافه کنید. در هر دور برای هر نفر امتیاز (مثلاً امتیاز رتبه + کیل) وارد می‌کنید.</p>
                {err("leaderboardRounds")}
              </div>
            ) : null}
            {v.format === "ROUND_ROBIN" || v.format === "GROUPS_KNOCKOUT" ? (
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="t-tiebreak">قانون رتبه‌بندی در امتیاز مساوی</Label>
                <NativeSelect id="t-tiebreak" value={v.tiebreak} onChange={(e) => set("tiebreak", e.target.value as TournamentFormValues["tiebreak"])}>
                  {TIEBREAKS.map((k) => <option key={k} value={k}>{TIEBREAK_LABELS[k]}</option>)}
                </NativeSelect>
              </div>
            ) : null}
            {v.format === "ROUND_ROBIN" || v.format === "GROUPS_KNOCKOUT" || v.format === "SWISS" ? (
              <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                {(["pointsWin", "pointsDraw", "pointsLoss"] as const).map((k) => (
                  <div key={k} className="grid gap-1.5">
                    <Label htmlFor={`t-${k}`}>{k === "pointsWin" ? "امتیاز برد" : k === "pointsDraw" ? "امتیاز مساوی" : "امتیاز باخت"}</Label>
                    <Input id={`t-${k}`} inputMode="numeric" dir="ltr" className="text-start" value={v[k]} onChange={text(k)} aria-invalid={!!errors[k]} />
                    {err(k)}
                  </div>
                ))}
              </div>
            ) : null}
            {v.format === "DOUBLE_ELIMINATION" ? (
              <div className="grid gap-2 sm:col-span-2" role="radiogroup" aria-label="فینال بزرگ">
                <p className="text-sm font-medium">فینال بزرگ</p>
                {GRAND_FINAL_MODES.map((m) => (
                  <label key={m} className="flex items-center gap-2 text-sm"><input type="radio" name="t-gf" checked={v.grandFinal === m} onChange={() => set("grandFinal", m)} className="size-4 accent-[var(--brand-green-dark)]" /> {GRAND_FINAL_LABELS[m]}</label>
                ))}
              </div>
            ) : null}
          </div>
        </fieldset>

        <fieldset className="grid gap-3 rounded-xl border p-3">
          <legend className="px-1 text-sm font-medium">ثبت‌نام و بازیکنان</legend>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.allowSelfRegistration} onChange={(e) => set("allowSelfRegistration", e.target.checked)} className="size-4 accent-[var(--brand-green-dark)]" /> ثبت‌نام آنلاین کاربران در سایت</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.waitlistEnabled} onChange={(e) => set("waitlistEnabled", e.target.checked)} className="size-4 accent-[var(--brand-green-dark)]" /> لیست انتظار وقتی ظرفیت پر شد (فقط تورنومنت رایگان)</label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={v.allowPlayerReports} onChange={(e) => set("allowPlayerReports", e.target.checked)} className="mt-1 size-4 accent-[var(--brand-green-dark)]" /> <span>بازیکنان نتیجهٔ بازی خودشان را گزارش کنند <span className="block text-xs text-muted-foreground">نتیجه وقتی ثبت می‌شود که حریف یا شما تأیید کنید (یا هر دو یک نتیجه را بفرستند).</span></span></label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={v.allowPredictions} onChange={(e) => set("allowPredictions", e.target.checked)} className="mt-1 size-4 accent-[var(--brand-green-dark)]" /> <span>پیش‌بینی نتایج توسط بازدیدکنندگان <span className="block text-xs text-muted-foreground">کاربران وارد شده برندهٔ هر بازی را قبل از شروعش پیش‌بینی می‌کنند و جدول بهترین پیش‌بینی‌کننده‌ها نمایش داده می‌شود.</span></span></label>
          <div className="grid gap-1.5 sm:max-w-xs">
            <Label htmlFor="t-team">تیمی — تعداد نفرات هر تیم (خالی = انفرادی)</Label>
            <Input id="t-team" inputMode="numeric" dir="ltr" className="text-start" value={v.teamSize} onChange={text("teamSize")} placeholder="مثلاً 2" aria-invalid={!!errors.teamSize} />
            {err("teamSize")}
          </div>
          <SignupQuestions value={v.signupQuestions} onChange={(q) => set("signupQuestions", q)} error={Object.entries(errors).find(([k]) => k.startsWith("signupQuestions"))?.[1]} />
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="t-prize">جایزه (اختیاری)</Label>
            <Input id="t-prize" value={v.prize} onChange={text("prize")} maxLength={500} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="t-fee-online">هزینهٔ ثبت‌نام آنلاین — تومان (اختیاری)</Label>
            <Input id="t-fee-online" inputMode="numeric" dir="ltr" className="text-start" value={v.entryFeeToman} onChange={text("entryFeeToman")} placeholder="0" aria-invalid={!!errors.entryFeeToman} aria-describedby="t-fee-online-help" />
            <p id="t-fee-online-help" className="text-xs leading-5 text-muted-foreground">اگر مبلغی بگذارید، بازیکن هنگام ثبت‌نام در سایت آن را با درگاه پرداخت می‌کند و بعد از پرداخت به فهرست اضافه می‌شود. خالی یا صفر = رایگان.</p>
            {err("entryFeeToman")}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="t-fee">توضیح ورودی (اختیاری)</Label>
            <Input id="t-fee" value={v.entryFeeNote} onChange={text("entryFeeNote")} maxLength={200} placeholder="مثلاً ۵۰ هزار تومان، پرداخت حضوری" />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="t-desc">توضیحات (اختیاری)</Label>
            <Textarea id="t-desc" rows={3} value={v.description} onChange={text("description")} maxLength={3000} />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="t-rules">قوانین (اختیاری)</Label>
            <Textarea id="t-rules" rows={5} value={v.rules} onChange={text("rules")} maxLength={5000} />
          </div>
        </div>
        <Button type="submit" size="lg" loading={pending} className="justify-self-start">{id ? "ذخیرهٔ تغییرات" : "ساخت تورنومنت"}</Button>
      </fieldset>
    </form>
  );
}

function SignupQuestions({ value, onChange, error }: { value: { label: string; required: boolean }[]; onChange: (q: { label: string; required: boolean }[]) => void; error?: string }) {
  const update = (i: number, patch: Partial<{ label: string; required: boolean }>) => onChange(value.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">سؤال‌های فرم ثبت‌نام (اختیاری)</p>
      <p className="text-xs text-muted-foreground">مثلاً «آیدی PSN»، «شمارهٔ تماس» یا «شهر». پاسخ‌ها فقط برای برگزارکنندگان نمایش داده می‌شود.</p>
      {value.map((q, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <Input aria-label={`سؤال ${(i + 1).toLocaleString("fa-IR")}`} className="min-w-0 flex-1" value={q.label} maxLength={120} onChange={(e) => update(i, { label: e.target.value })} />
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={q.required} onChange={(e) => update(i, { required: e.target.checked })} className="size-4 accent-[var(--brand-green-dark)]" /> اجباری</label>
          <Button type="button" variant="ghost" size="icon-sm" className="text-destructive" aria-label="حذف سؤال" onClick={() => onChange(value.filter((_, j) => j !== i))}><X /></Button>
        </div>
      ))}
      {value.length < MAX_SIGNUP_QUESTIONS ? (
        <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => onChange([...value, { label: "", required: false }])}><Plus /> افزودن سؤال</Button>
      ) : null}
      {error ? <p role="alert" className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
