"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendTestEmail } from "@/features/mail/test-actions";

export function MailTestForm() {
  const [to, setTo] = React.useState("");
  const [result, setResult] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = React.useTransition();

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await sendTestEmail(to);
          setResult(res.ok ? { ok: true, text: res.message ?? "ارسال شد." } : { ok: false, text: res.error });
        });
      }}
    >
      <div className="grid gap-1.5 sm:max-w-sm">
        <Label htmlFor="mail-to">ایمیل گیرنده</Label>
        <Input id="mail-to" type="email" dir="ltr" className="text-start" value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@gmail.com" />
      </div>
      <div>
        <Button type="submit" loading={pending} disabled={!to.trim()}>
          <Send /> ارسال ایمیل آزمایشی
        </Button>
      </div>
      {result ? (
        <Alert variant={result.ok ? "success" : "destructive"}>
          <span className="break-words">{result.text}</span>
        </Alert>
      ) : null}
    </form>
  );
}
