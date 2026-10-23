"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { createTournament, updateTournament } from "@/features/tournaments/actions";
import { FORMAT_HINTS, FORMAT_LABELS, TOURNAMENT_FORMATS, type TournamentFormatKey } from "@/features/tournaments/constants";
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
  startsAtLocal: string; // yyyy-MM-ddTHH:mm in Tehran time
  format: TournamentFormatKey;
  maxParticipants: string;
  allowSelfRegistration: boolean;
  thirdPlaceMatch: boolean;
  doubleRoundRobin: boolean;
  groupCount: string;
  advancePerGroup: string;
  pointsWin: string;
  pointsDraw: string;
  pointsLoss: string;
}

export const emptyTournament: TournamentFormValues = {
  name: "",
  game: "EA SPORTS FC",
  platform: "PS5",
  description: "",
  rules: "",
  prize: "",
  entryFeeNote: "",
  startsAtLocal: "",
  format: "SINGLE_ELIMINATION",
  maxParticipants: "16",
  allowSelfRegistration: true,
  thirdPlaceMatch: true,
  doubleRoundRobin: false,
  groupCount: "4",
  advancePerGroup: "2",
  pointsWin: "3",
  pointsDraw: "1",
  pointsLoss: "0",
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
            <Input id="t-name" value={v.name} onChange={text("name")} maxLength={120} placeholder="مثلاً جام هفتگی FC آتم" aria-invalid={!!errors.name} />
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
            <Label htmlFor="t-start">زمان شروع — به وقت تهران (اختیاری)</Label>
            <Input id="t-start" type="datetime-local" dir="ltr" value={v.startsAtLocal} onChange={text("startsAtLocal")} aria-invalid={!!errors.startsAt} />
            {err("startsAt")}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="t-max">ظرفیت (اختیاری)</Label>
            <Input id="t-max" inputMode="numeric" dir="ltr" className="text-start" value={v.maxParticipants} onChange={text("maxParticipants")} aria-invalid={!!errors.maxParticipants} />
            {err("maxParticipants")}
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
            {v.format === "ROUND_ROBIN" || v.format === "GROUPS_KNOCKOUT" ? (
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
            {v.format === "DOUBLE_ELIMINATION" ? <p className="text-xs text-muted-foreground sm:col-span-2">اگر برندهٔ جدول بازندگان در فینال ببرد، بازی دوم فینال (ریست) برگزار می‌شود.</p> : null}
          </div>
        </fieldset>

        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.allowSelfRegistration} onChange={(e) => set("allowSelfRegistration", e.target.checked)} className="size-4 accent-[var(--brand-green-dark)]" /> ثبت‌نام آنلاین کاربران در سایت</label>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="t-prize">جایزه (اختیاری)</Label>
            <Input id="t-prize" value={v.prize} onChange={text("prize")} maxLength={500} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="t-fee">ورودی (اختیاری)</Label>
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
