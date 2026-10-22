import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getPaymentProvider } from "@/features/payments";
import { env } from "@/lib/env";
import { formatToman } from "@/lib/format";

export const metadata: Metadata = { title: "درگاه آزمایشی", robots: { index: false } };

// DEVELOPMENT ONLY: simulates a bank page for the sandbox provider.
export default function SandboxGatewayPage({ searchParams }: PageProps<"/payments/sandbox">) {
  return (
    <Container className="flex flex-1 items-center justify-center py-16">
      <Suspense>
        <SandboxContent searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function SandboxContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (env.NODE_ENV === "production" || getPaymentProvider()?.key !== "sandbox") notFound();
  const sp = await searchParams;
  const authority = String(sp.authority ?? "");
  const amount = /^\d+$/.test(String(sp.amount ?? "")) ? BigInt(String(sp.amount)) : BigInt(0);
  if (!authority.startsWith("SBX-")) notFound();
  const back = (status: "OK" | "NOK") => `/api/payments/callback/sandbox?authority=${encodeURIComponent(authority)}&status=${status}`;
  return (
    <Card className="w-full max-w-md">
      <CardContent className="space-y-5 text-center">
        <FlaskConical className="mx-auto size-10 text-info" aria-hidden />
        <h1 className="text-xl font-black">درگاه پرداخت آزمایشی</h1>
        <Alert variant="warning">این صفحه فقط در محیط توسعه وجود دارد و پولی جابه‌جا نمی‌شود.</Alert>
        <p className="text-2xl font-black">{formatToman(amount)}</p>
        <div className="grid grid-cols-2 gap-3">
          <Button asChild><a href={back("OK")}>پرداخت موفق</a></Button>
          <Button asChild variant="outline"><a href={back("NOK")}>انصراف / ناموفق</a></Button>
        </div>
      </CardContent>
    </Card>
  );
}
