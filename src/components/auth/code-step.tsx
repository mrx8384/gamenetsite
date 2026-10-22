"use client";

import * as React from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toPersianDigits } from "@/lib/format";

/** Second step of code-based flows: enter the 6-digit code, resend, or go back. */
export function CodeStep({
  masked,
  code,
  onCodeChange,
  error,
  secondsLeft,
  onResend,
  onBack,
  resending,
  children,
}: {
  masked: string;
  code: string;
  onCodeChange: (v: string) => void;
  error?: string;
  secondsLeft: number;
  onResend: () => void;
  onBack: () => void;
  resending?: boolean;
  children?: React.ReactNode;
}) {
  const id = React.useId();
  return (
    <div className="grid gap-4">
      <p className="text-sm leading-7 text-muted-foreground">
        کد ۶ رقمی ارسال‌شده به <span className="ltr font-semibold text-foreground">{masked}</span> را وارد کنید.
      </p>
      <div className="grid gap-1.5">
        <Label htmlFor={id}>کد تأیید</Label>
        <Input
          id={id}
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          dir="ltr"
          autoFocus
          aria-invalid={!!error}
          className="h-12 text-center text-xl tracking-[0.5em]"
          placeholder="------"
        />
        {error ? (
          <p role="alert" className="text-xs font-medium text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      {children}
      <div className="flex items-center justify-between text-sm">
        <button type="button" onClick={onBack} className="inline-flex cursor-pointer items-center gap-1 text-muted-foreground hover:text-foreground">
          <ArrowRight className="size-4" /> اصلاح اطلاعات
        </button>
        {secondsLeft > 0 ? (
          <span className="text-muted-foreground">ارسال دوباره تا {toPersianDigits(secondsLeft)} ثانیه</span>
        ) : (
          <Button type="button" variant="link" size="sm" onClick={onResend} disabled={resending}>
            ارسال دوبارهٔ کد
          </Button>
        )}
      </div>
    </div>
  );
}
