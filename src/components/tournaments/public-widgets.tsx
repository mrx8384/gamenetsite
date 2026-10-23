"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerForTournament, withdrawFromTournament } from "@/features/tournaments/actions";

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

export function RegistrationBox({ tournamentId, state, defaultName, entryName, slug }: { tournamentId: string; state: "guest" | "open" | "registered" | "full"; defaultName: string; entryName?: string; slug: string }) {
  const router = useRouter();
  const [name, setName] = React.useState(defaultName);
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
  if (state === "registered") {
    return (
      <div className="space-y-2 text-sm">
        <p className="font-bold text-success">شما با نام «{entryName}» ثبت‌نام کرده‌اید.</p>
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
      </div>
    );
  }
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await registerForTournament(tournamentId, name);
          if (!res.ok) {
            setError(res.fieldErrors?.name ?? res.error);
            return void toast.error(res.error);
          }
          setError(null);
          toast.success(res.message);
          router.refresh();
        });
      }}
    >
      <Label htmlFor="reg-name">نام شما در جدول (گیمرتگ)</Label>
      <div className="flex gap-2">
        <Input id="reg-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-invalid={!!error} aria-describedby={error ? "reg-error" : undefined} />
        <Button type="submit" loading={pending}>ثبت‌نام</Button>
      </div>
      {error ? <p id="reg-error" role="alert" className="text-xs font-medium text-destructive">{error}</p> : null}
    </form>
  );
}
