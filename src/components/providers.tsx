"use client";

import { Direction } from "radix-ui";
import { Toaster } from "@/components/ui/toaster";

/** Client-side providers. RTL direction for all Radix primitives. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Direction.Provider dir="rtl">
      {children}
      <Toaster />
    </Direction.Provider>
  );
}
