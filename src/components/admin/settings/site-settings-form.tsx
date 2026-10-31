"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveSiteSettings } from "@/features/settings/actions";
import type { FieldDef } from "@/features/settings/site-schema";
import { toPersianDigits } from "@/lib/format";
import { useHydrated } from "@/lib/hooks/use-hydrated";

export function SiteSettingsForm({ group, description, fields, initial }: { group: string; description: string; fields: readonly FieldDef[]; initial: Record<string, string> }) {
  const router = useRouter();
  const [values, setValues] = React.useState(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();
  // Inputs stay disabled until hydrated: typing during hydration could be clobbered, and saving needs JS anyway.
  const hydrated = useHydrated();
  const dirty = fields.some((f) => values[f.key] !== initial[f.key]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveSiteSettings(group, values);
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
    <form onSubmit={submit} noValidate className="max-w-3xl space-y-4">
      <p className="text-sm text-muted-foreground">{description}</p>
      <fieldset disabled={!hydrated} className="contents">
      <Card>
        <CardContent className="grid gap-5">
          {fields.map((f) => {
            const id = `f-${f.key}`;
            const ltr = f.type === "url" || f.type === "email" || f.type === "phone" || f.type === "map";
            const val = values[f.key] ?? "";
            return (
              <div key={f.key} className="grid gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={id}>{f.label}</Label>
                  <span className="text-xs text-muted-foreground">{toPersianDigits(val.length)}/{toPersianDigits(f.max)}</span>
                </div>
                {f.type === "textarea" || f.type === "map" ? (
                  <Textarea id={id} rows={3} value={val} maxLength={f.max} dir={ltr ? "ltr" : undefined} className={ltr ? "text-start" : undefined} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} aria-invalid={!!errors[f.key]} />
                ) : (
                  <Input
                    id={id}
                    value={val}
                    maxLength={f.max}
                    dir={ltr ? "ltr" : undefined}
                    className={ltr ? "text-start" : undefined}
                    inputMode={f.type === "phone" ? "tel" : f.type === "email" ? "email" : f.type === "url" ? "url" : undefined}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                    aria-invalid={!!errors[f.key]}
                  />
                )}
                {errors[f.key] ? <p role="alert" className="text-xs font-medium text-destructive">{errors[f.key]}</p> : f.hint ? <p className="text-xs text-muted-foreground">{f.hint}</p> : null}
                {f.default && val.trim() === "" ? <p className="text-xs text-muted-foreground">اگر خالی بماند، متن پیش‌فرض نمایش داده می‌شود.</p> : null}
              </div>
            );
          })}
        </CardContent>
      </Card>
      </fieldset>
      <div className="sticky bottom-4 flex justify-end">
        <Button type="submit" size="lg" loading={pending} disabled={!dirty} className="shadow-lg">ذخیرهٔ تغییرات</Button>
      </div>
    </form>
  );
}
