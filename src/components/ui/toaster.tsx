"use client";

import { Toaster as Sonner } from "sonner";

/** App-wide toast host. Use `toast.success("...")` from "sonner" for feedback. */
export function Toaster() {
  return (
    <Sonner
      dir="rtl"
      position="top-center"
      closeButton
      richColors
      toastOptions={{
        style: { fontFamily: "var(--font-sans)" },
        classNames: { toast: "rounded-xl! border! shadow-card!" },
      }}
    />
  );
}
