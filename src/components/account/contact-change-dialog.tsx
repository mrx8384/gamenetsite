"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CodeStep } from "@/components/auth/code-step";
import { useCountdown } from "@/components/auth/use-countdown";
import { confirmContactChange, requestContactChange } from "@/features/account/actions";

export function ContactChangeDialog({ kind, hasValue }: { kind: "phone" | "email"; hasValue: boolean }) {
  const router = useRouter();
  const countdown = useCountdown();
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");
  const [masked, setMasked] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();
  const label = kind === "phone" ? "شمارهٔ موبایل" : "ایمیل";

  function reset() {
    setValue("");
    setMasked(null);
    setCode("");
    setError(undefined);
  }

  function send() {
    setError(undefined);
    startTransition(async () => {
      const res = await requestContactChange({ identifier: value });
      if (!res.ok) return setError(res.fieldErrors?.identifier ?? res.error);
      setMasked(res.data.masked);
      countdown.start(res.data.cooldownSeconds);
    });
  }

  function confirm() {
    setError(undefined);
    startTransition(async () => {
      const res = await confirmContactChange({ identifier: value, code });
      if (!res.ok) return setError(res.fieldErrors?.code ?? res.error);
      toast.success(res.message);
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {hasValue ? "تغییر" : "افزودن"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{hasValue ? `تغییر ${label}` : `افزودن ${label}`}</DialogTitle>
          <DialogDescription>برای تأیید، یک کد ۶ رقمی به {label} جدید ارسال می‌شود.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (masked) confirm();
            else send();
          }}
          className="grid gap-4"
        >
          {masked ? (
            <CodeStep
              masked={masked}
              code={code}
              onCodeChange={setCode}
              error={error}
              secondsLeft={countdown.seconds}
              onResend={send}
              onBack={() => setMasked(null)}
              resending={pending}
            />
          ) : (
            <div className="grid gap-1.5">
              <Label htmlFor={`new-${kind}`}>{label} جدید</Label>
              <Input
                id={`new-${kind}`}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                dir="ltr"
                className="text-start"
                inputMode={kind === "phone" ? "tel" : "email"}
                placeholder={kind === "phone" ? "09121234567" : "name@example.com"}
                aria-invalid={!!error}
                autoFocus
              />
              {error ? (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {error}
                </p>
              ) : null}
            </div>
          )}
          <Button type="submit" loading={pending}>
            {masked ? "تأیید" : "ارسال کد"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
