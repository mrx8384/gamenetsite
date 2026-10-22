"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 items-center px-4 py-24">
      <ErrorState
        className="w-full"
        action={
          <Button variant="outline" onClick={reset}>
            تلاش دوباره
          </Button>
        }
      />
    </main>
  );
}
