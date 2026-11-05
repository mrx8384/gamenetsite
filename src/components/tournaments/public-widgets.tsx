"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkInToTournament, registerForTournament, withdrawFromTournament } from "@/features/tournaments/actions";
import { leaveWaitlist } from "@/features/tournaments/community-actions";

/** Re-renders the page every 30 s while a tournament is running (new results appear without reload). */
export function LiveRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  React.useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30_000);
    return () => window.clearInterval(t);
  }, [active, router]);
  return null;
}

export function RegistrationBox({
  tournamentId,
  state,
  defaultName,
  entryName,
  slug,
  feeLabel,
  paid = false,
  checkIn,
  teamSize = null,
  questions = [],
  waitlistPosition,
}: {
  tournamentId: string;
  /** "waitlist" = full, but new sign-ups join the waiting list; "waitlisted" = this user is on it. */
  state: "guest" | "open" | "registered" | "full" | "waitlist" | "waitlisted";
  defaultName: string;
  entryName?: string;
  slug: string;
  /** e.g. «۵۰٬۰۰۰ تومان» when registration is paid online. */
  feeLabel?: string;
  /** The player paid online (withdrawing goes through support). */
  paid?: boolean;
  /** Check-in state when the tournament uses check-in. */
  checkIn?: { open: boolean; done: boolean; opensAt: string };
  /** Team tournaments: players per team incl. the captain. */
  teamSize?: number | null;
  questions?: { label: string; required: boolean }[];
  waitlistPosition?: number;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(teamSize ? "" : defaultName);
  const [members, setMembers] = React.useState<string[]>(() => Array.from({ length: teamSize ? teamSize - 1 : 0 }, () => ""));
  const [answers, setAnswers] = React.useState<string[]>(() => questions.map(() => ""));
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  if (state === "guest") {
    return (
      <div className="space-y-2 text-sm">
        <p>برای ثبت‌نام وارد حساب کاربری شوید.</p>
        <Button asChild variant="strong"><Link href={`/login?next=${encodeURIComponent(`/tournaments/${slug}`)}`}>ورود و ثبت‌نام</Link></Button>
      </div>
    );
  }
  if (state === "full") return <p className="text-sm font-medium text-warning">ظرفیت تکمیل است.</p>;
  if (state === "waitlisted") {
    return (
      <div className="space-y-2 text-sm">
        <p className="font-bold text-warning">شما در لیست انتظار هستید{waitlistPosition ? ` (نفر ${waitlistPosition.toLocaleString("fa-IR")})` : ""}. اگر جایی خالی شود، خودکار به شرکت‌کنندگان اضافه می‌شوید.</p>
        <Button
          variant="outline"
          size="sm"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await leaveWaitlist(tournamentId);
              if (!res.ok) return void toast.error(res.error);
              toast.success(res.message);
              router.refresh();
            })
          }
        >
          خروج از لیست انتظار
        </Button>
      </div>
    );
  }
  if (state === "registered") {
    return (
      <div className="space-y-2 text-sm">
        <p className="font-bold text-success">شما با نام «{entryName}» ثبت‌نام کرده‌اید.{paid ? " هزینهٔ ثبت‌نام پرداخت شده است." : ""}</p>
        {checkIn ? (
          checkIn.done ? (
            <p className="font-semibold text-success">✓ حضور شما تأیید شده است.</p>
          ) : checkIn.open ? (
            <div className="space-y-1 rounded-lg border border-warning/40 bg-warning-soft p-3">
              <p className="font-semibold">چک‌این باز است: حضورتان را تأیید کنید، وگرنه موقع شروع از فهرست حذف می‌شوید.</p>
              <Button
                size="sm"
                loading={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await checkInToTournament(tournamentId);
                    if (!res.ok) return void toast.error(res.error);
                    toast.success(res.message);
                    router.refresh();
                  })
                }
              >
                تأیید حضور (چک‌این)
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground">چک‌این از {new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran", dateStyle: "medium", timeStyle: "short" }).format(new Date(checkIn.opensAt))} باز می‌شود؛ آن موقع حضورتان را تأیید کنید.</p>
          )
        ) : null}
        {paid ? (
          <p className="text-muted-foreground">برای انصراف و بازگشت هزینه با پشتیبانی اتم تماس بگیرید.</p>
        ) : (
        <Button
          variant="outline"
          size="sm"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await withdrawFromTournament(tournamentId);
              if (!res.ok) return void toast.error(res.error);
              toast.success(res.message);
              router.refresh();
            })
          }
        >
          انصراف از تورنومنت
        </Button>
        )}
      </div>
    );
  }
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await registerForTournament(tournamentId, { name, members, answers });
          if (!res.ok) {
            setError(res.error);
            return void toast.error(res.error);
          }
          setError(null);
          if (res.data.redirectTo) return void window.location.assign(res.data.redirectTo); // gateway page (may be external)
          toast.success(res.message);
          router.refresh();
        });
      }}
    >
      {state === "waitlist" ? <p className="text-sm font-medium text-warning">ظرفیت پر است؛ با ثبت‌نام در لیست انتظار قرار می‌گیرید و اگر جایی خالی شود خودکار اضافه می‌شوید.</p> : null}
      <Label htmlFor="reg-name">{teamSize ? "نام تیم" : "نام شما در جدول (گیمرتگ)"}</Label>
      <Input id="reg-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-invalid={!!error} aria-describedby={error ? "reg-error" : undefined} />
      {members.length ? (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">هم‌تیمی‌ها (شما سرگروه هستید)</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {members.map((m, i) => (
              <Input key={i} aria-label={`هم‌تیمی ${(i + 1).toLocaleString("fa-IR")}`} placeholder={`هم‌تیمی ${(i + 1).toLocaleString("fa-IR")}`} value={m} maxLength={60} onChange={(e) => setMembers((x) => x.map((y, j) => (j === i ? e.target.value : y)))} />
            ))}
          </div>
        </fieldset>
      ) : null}
      {questions.map((q, i) => (
        <div key={i} className="grid gap-1.5">
          <Label htmlFor={`reg-q-${i}`}>{q.label}{q.required ? " *" : " (اختیاری)"}</Label>
          <Input id={`reg-q-${i}`} value={answers[i] ?? ""} maxLength={500} required={q.required} onChange={(e) => setAnswers((x) => x.map((y, j) => (j === i ? e.target.value : y)))} />
        </div>
      ))}
      {questions.length ? <p className="text-xs text-muted-foreground">پاسخ‌ها فقط به برگزارکننده نمایش داده می‌شود.</p> : null}
      <Button type="submit" loading={pending}>{state === "waitlist" ? "ثبت در لیست انتظار" : feeLabel ? `ثبت‌نام و پرداخت ${feeLabel}` : "ثبت‌نام"}</Button>
      {feeLabel ? <p className="text-xs leading-6 text-muted-foreground">هزینهٔ ثبت‌نام آنلاین پرداخت می‌شود؛ بعد از پرداخت، نام شما به فهرست شرکت‌کنندگان اضافه می‌شود.</p> : null}
      {error ? <p id="reg-error" role="alert" className="text-xs font-medium text-destructive">{error}</p> : null}
    </form>
  );
}
