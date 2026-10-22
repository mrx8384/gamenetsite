"use client";

import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitContactMessage } from "@/features/contact/actions";

const empty = { name: "", email: "", phone: "", subject: "", body: "", website: "" };

export function ContactForm() {
  const [v, setV] = React.useState(empty);
  // Set in the browser after mount (not at prerender time) for the "submitted too fast" bot check.
  const startedAt = React.useRef(0);
  React.useEffect(() => {
    startedAt.current = Date.now();
  }, []);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [done, setDone] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });
  const err = (k: string) => (errors[k] ? <p role="alert" className="text-xs font-medium text-destructive">{errors[k]}</p> : null);

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-success-soft p-8 text-center" role="status">
        <CheckCircle2 className="size-10 text-success" aria-hidden />
        <p className="font-bold">{done}</p>
        <Button variant="outline" onClick={() => { setDone(null); setV(empty); }}>ارسال پیام دیگر</Button>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await submitContactMessage({ ...v, startedAt: startedAt.current });
          if (!res.ok) {
            setErrors(res.fieldErrors ?? {});
            return void toast.error(res.error);
          }
          setErrors({});
          setDone(res.message ?? "پیام ارسال شد.");
        });
      }}
    >
      <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="c-name">نام و نام خانوادگی</Label><Input id="c-name" autoComplete="name" value={v.name} onChange={set("name")} aria-invalid={!!errors.name} />{err("name")}</div>
      <div className="grid gap-1.5"><Label htmlFor="c-phone">شمارهٔ موبایل</Label><Input id="c-phone" dir="ltr" className="text-start" inputMode="tel" autoComplete="tel" value={v.phone} onChange={set("phone")} aria-invalid={!!errors.phone} />{err("phone")}</div>
      <div className="grid gap-1.5"><Label htmlFor="c-email">ایمیل</Label><Input id="c-email" dir="ltr" className="text-start" type="email" autoComplete="email" value={v.email} onChange={set("email")} aria-invalid={!!errors.email} />{err("email")}</div>
      <p className="-mt-2 text-xs text-muted-foreground sm:col-span-2">حداقل یکی از موبایل یا ایمیل را وارد کنید.</p>
      <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="c-subject">موضوع</Label><Input id="c-subject" value={v.subject} onChange={set("subject")} aria-invalid={!!errors.subject} />{err("subject")}</div>
      <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="c-body">متن پیام</Label><Textarea id="c-body" rows={6} maxLength={5000} value={v.body} onChange={set("body")} aria-invalid={!!errors.body} />{err("body")}</div>
      {/* Honeypot (hidden from people and screen readers) */}
      <div aria-hidden className="absolute -start-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="c-website">وب‌سایت</label>
        <input id="c-website" tabIndex={-1} autoComplete="off" value={v.website} onChange={set("website")} />
      </div>
      <Button type="submit" size="lg" loading={pending} className="sm:col-span-2 sm:justify-self-start">ارسال پیام</Button>
    </form>
  );
}
