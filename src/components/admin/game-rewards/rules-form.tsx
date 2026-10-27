"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveRewardRules } from "@/features/game-rewards/admin-actions";
import type { RewardRules } from "@/features/game-rewards/rules";
import { formatNumber } from "@/lib/format";

export interface AchievementRow {
  id: string;
  emoji: string;
  title: string;
  hint: string;
  hidden: boolean;
  defaultPoints: number;
  game: string;
}

/** Points rules + points per achievement (empty = the game's default). */
export function RewardRulesForm({ rules, achievements }: { rules: RewardRules; achievements: AchievementRow[] }) {
  const router = useRouter();
  const [v, setV] = React.useState({
    enabled: rules.enabled,
    perRound: String(rules.perRound),
    roundsPerDay: String(rules.roundsPerDay),
    minSecondsBetweenRounds: String(rules.minSecondsBetweenRounds),
  });
  const [points, setPoints] = React.useState<Record<string, string>>(Object.fromEntries(Object.entries(rules.achievementPoints).map(([k, n]) => [k, String(n)])));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();
  const games = [...new Set(achievements.map((a) => a.game))];
  const err = (k: string) => (errors[k] ? <p role="alert" className="text-xs font-medium text-destructive">{errors[k]}</p> : null);
  const maxPerDay = (Number(v.perRound) || 0) * (Number(v.roundsPerDay) || 0);
  const allAchievements = achievements.reduce((t, a) => t + (points[a.id] ? Number(points[a.id]) || 0 : a.defaultPoints), 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const achievementPoints = Object.fromEntries(Object.entries(points).filter(([, s]) => s.trim() !== "").map(([k, s]) => [k, s.trim()]));
    startTransition(async () => {
      const res = await saveRewardRules({ ...v, achievementPoints });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        return void toast.error(res.error);
      }
      setErrors({});
      toast.success(res.message);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-6">
      <section className="grid gap-4 rounded-xl border bg-surface p-4">
        <h2 className="font-bold">امتیاز هر دور بازی</h2>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={v.enabled} onChange={(e) => setV({ ...v, enabled: e.target.checked })} className="size-4 accent-[var(--brand-green-dark)]" />
          جمع کردن امتیاز در دنیای سه‌بعدی روشن باشد
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="r-per">امتیاز هر دور</Label>
            <Input id="r-per" inputMode="numeric" dir="ltr" value={v.perRound} onChange={(e) => setV({ ...v, perRound: e.target.value })} aria-invalid={!!errors.perRound} />
            {err("perRound")}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="r-day">حداکثر دور با امتیاز در روز</Label>
            <Input id="r-day" inputMode="numeric" dir="ltr" value={v.roundsPerDay} onChange={(e) => setV({ ...v, roundsPerDay: e.target.value })} aria-invalid={!!errors.roundsPerDay} />
            {err("roundsPerDay")}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="r-gap">کمترین فاصلهٔ دو دور (ثانیه)</Label>
            <Input id="r-gap" inputMode="numeric" dir="ltr" value={v.minSecondsBetweenRounds} onChange={(e) => setV({ ...v, minSecondsBetweenRounds: e.target.value })} aria-invalid={!!errors.minSecondsBetweenRounds} />
            {err("minSecondsBetweenRounds")}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          هر کاربر حداکثر روزانه {formatNumber(maxPerDay)} امتیاز از دورهای بازی می‌گیرد؛ همهٔ دستاوردها روی هم {formatNumber(allAchievements)} امتیاز (هر کدام یک بار). مینی‌گیم‌ها روی گوشی
          بازیکن اجرا می‌شوند و تقلب کامل قابل جلوگیری نیست؛ قیمت کارت‌ها را با توجه به همین سقف‌ها تعیین کنید.
        </p>
      </section>

      <section className="grid gap-4">
        <h2 className="font-bold">امتیاز دستاوردها</h2>
        <p className="text-sm text-muted-foreground">خالی بگذارید تا امتیاز پیش‌فرض بازی استفاده شود. ۰ یعنی این دستاورد امتیازی ندارد.</p>
        {games.map((g) => (
          <div key={g} className="rounded-xl border bg-surface">
            <h3 className="border-b px-4 py-2 text-sm font-bold">{g}</h3>
            <ul className="divide-y">
              {achievements
                .filter((a) => a.game === g)
                .map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    <span aria-hidden className="text-xl">
                      {a.emoji}
                    </span>
                    <div className="min-w-48 flex-1">
                      <p className="font-medium">
                        {a.title} {a.hidden ? <Badge variant="warning">مخفی</Badge> : null}
                      </p>
                      <p className="text-xs text-muted-foreground">{a.hint}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`a-${a.id}`} className="text-xs text-muted-foreground">
                        امتیاز
                      </Label>
                      <Input
                        id={`a-${a.id}`}
                        className="w-24"
                        inputMode="numeric"
                        dir="ltr"
                        placeholder={String(a.defaultPoints)}
                        value={points[a.id] ?? ""}
                        onChange={(e) => setPoints({ ...points, [a.id]: e.target.value })}
                      />
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </section>
      {err("achievementPoints")}
      <div>
        <Button type="submit" loading={pending}>
          ذخیرهٔ قوانین
        </Button>
      </div>
    </form>
  );
}
