"use client";

import { useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { GOOGLE_ERRORS } from "@/features/auth/google-claims";

/** Explains why «ادامه با گوگل» did not finish (/login?error=google_…). */
export function GoogleError() {
  const code = useSearchParams().get("error");
  const message = code ? GOOGLE_ERRORS[code] : undefined;
  return message ? <Alert variant="destructive" className="mb-4">{message}</Alert> : null;
}
