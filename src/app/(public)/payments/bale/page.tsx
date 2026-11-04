import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { FlaskConical, Wallet } from "lucide-react";
import { BalePaymentStatus } from "@/components/payments/bale-payment-status";
import { Container } from "@/components/layout/container";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingRows } from "@/components/ui/states";
import { getPaymentProviderByKey } from "@/features/payments";
import { botUsername, isTestToken } from "@/features/payments/providers/bale/api";
import { botLink } from "@/features/payments/providers/bale/logic";
import { getCurrentUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatToman } from "@/lib/format";

export const metadata: Metadata = { title: "پرداخت با کیف پول بله", robots: { index: false } };

export default function BalePaymentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <Container className="flex flex-1 items-start justify-center py-10 sm:py-16">
      <Suspense fallback={<LoadingRows rows={4} />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  if (!getPaymentProviderByKey("bale")) notFound();
  const code = String((await searchParams).code ?? "");
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/payments/bale?code=${code}`)}`);
  const p = code
    ? await db.payment.findUnique({
        where: { provider_authority: { provider: "bale", authority: code } },
        select: { status: true, amount: true, order: { select: { number: true, userId: true, status: true } } },
      })
    : null;
  if (!p?.order || p.order.userId !== user.id) notFound();
  if (p.status === "SUCCEEDED") redirect(`/account/orders/${encodeURIComponent(p.order.number)}?payment=paid`);

  let link: string | null = null;
  try {
    link = botLink(await botUsername(), code);
  } catch (e) {
    console.error("[bale] bot username failed:", e instanceof Error ? e.message : e);
  }

  return (
    <Card className="w-full max-w-md">
      <CardContent className="space-y-5 pt-6 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-green/15 text-brand-green-deep">
          <Wallet className="size-7" aria-hidden />
        </span>
        <div className="space-y-1">
          <h1 className="text-xl font-black">پرداخت با کیف پول بله</h1>
          <p className="text-sm text-muted-foreground">سفارش <span className="ltr font-medium">{p.order.number}</span></p>
          <p className="text-2xl font-black">{formatToman(p.amount)}</p>
        </div>
        {isTestToken() ? (
          <Alert variant="warning" title="حالت آزمایشی">
            <span className="inline-flex items-center gap-1"><FlaskConical className="size-4" aria-hidden /> با توکن آزمایشی بله پرداخت می‌شود و پولی منتقل نمی‌شود.</span>
          </Alert>
        ) : null}
        <ol className="space-y-2 text-start text-sm leading-7 text-muted-foreground">
          <li>۱. روی دکمهٔ زیر بزنید تا بات فروشگاه در اپ <b>بله</b> باز شود و «شروع» را بزنید.</li>
          <li>۲. بات یک «درخواست پول» با همین مبلغ می‌فرستد؛ آن را با کیف پول بله پرداخت کنید.</li>
          <li>۳. بعد از پرداخت به همین صفحه برگردید؛ سفارش خودکار تأیید می‌شود.</li>
        </ol>
        {link ? (
          <Button asChild size="lg" className="w-full">
            <a href={link} target="_blank" rel="noopener noreferrer">پرداخت در بله</a>
          </Button>
        ) : (
          <Alert variant="destructive">اتصال به بله برقرار نشد. چند لحظه بعد صفحه را تازه کنید.</Alert>
        )}
        <p className="text-xs leading-6 text-muted-foreground">
          اگر بات کد را نشناخت، این کد را در گفت‌وگو با بات بفرستید:
          <code dir="ltr" className="mt-1 block rounded-lg bg-secondary px-2 py-1 text-xs break-all select-all">{code}</code>
        </p>
        <BalePaymentStatus code={code} />
      </CardContent>
    </Card>
  );
}
