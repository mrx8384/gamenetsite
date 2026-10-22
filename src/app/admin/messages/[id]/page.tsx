import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Mail, Phone } from "lucide-react";
import { MessageActions } from "@/components/admin/messages/message-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingRows } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDateTime, toPersianDigits } from "@/lib/format";

export const metadata: Metadata = { title: "پیام" };

export default function MessagePage({ params }: PageProps<"/admin/messages/[id]">) {
  return <Suspense fallback={<LoadingRows rows={4} />}><Message params={params} /></Suspense>;
}

async function Message({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole(["ADMIN"], `/admin/messages/${id}`);
  const m = await db.contactMessage.findUnique({ where: { id } });
  if (!m) notFound();
  return (
    <div className="max-w-3xl space-y-4">
      <Link href="/admin/messages" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronRight className="size-4" /> پیام‌ها</Link>
      <Card>
        <CardHeader>
          <CardTitle>{m.subject}</CardTitle>
          <p className="text-sm text-muted-foreground">{m.name} · {formatDateTime(m.createdAt)}</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="leading-8 whitespace-pre-line">{m.body}</p>
          <div className="flex flex-wrap gap-2 border-t pt-4">
            {m.email ? <Button asChild variant="outline" size="sm"><a href={`mailto:${m.email}?subject=${encodeURIComponent(`پاسخ: ${m.subject}`)}`}><Mail /> <span className="ltr">{m.email}</span></a></Button> : null}
            {m.phone ? <Button asChild variant="outline" size="sm"><a href={`tel:${m.phone}`}><Phone /> <span className="ltr">{toPersianDigits(m.phone)}</span></a></Button> : null}
          </div>
          <MessageActions id={m.id} status={m.status} />
        </CardContent>
      </Card>
    </div>
  );
}
