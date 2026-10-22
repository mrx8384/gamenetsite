import type { Metadata } from "next";
import { Suspense } from "react";
import { Monitor } from "lucide-react";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { RevokeSessionButton, SessionBulkActions } from "@/components/account/session-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingRows } from "@/components/ui/states";
import { getSession, requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { describeUserAgent } from "@/lib/user-agent";

export const metadata: Metadata = { title: "امنیت و نشست‌ها", robots: { index: false } };

export default function SecurityPage() {
  return (
    <Suspense fallback={<LoadingRows rows={6} />}>
      <SecurityContent />
    </Suspense>
  );
}

async function SecurityContent() {
  const user = await requireUser("/account/security");
  const current = await getSession();
  const sessions = await db.session.findMany({
    where: { userId: user.id, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, ip: true, userAgent: true, createdAt: true, lastSeenAt: true },
  });

  return (
    <>
      <h1 className="text-2xl font-black">امنیت و نشست‌ها</h1>

      <Card>
        <CardHeader>
          <CardTitle>تغییر رمز عبور</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>دستگاه‌های واردشده</CardTitle>
          <CardDescription>اگر دستگاهی را نمی‌شناسید، آن را خارج کنید و رمز عبور را تغییر دهید.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ul className="divide-y rounded-xl border">
            {sessions.map((s) => {
              const isCurrent = s.id === current?.sessionId;
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <Monitor className="mt-1 size-5 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0 text-sm">
                      <p className="flex flex-wrap items-center gap-2 font-semibold">
                        {describeUserAgent(s.userAgent)}
                        {isCurrent ? <Badge variant="success">همین دستگاه</Badge> : null}
                      </p>
                      <p className="text-muted-foreground">
                        آخرین فعالیت: {formatDateTime(s.lastSeenAt)} · ورود: {formatDateTime(s.createdAt)}
                      </p>
                      {s.ip ? <p className="ltr text-start text-xs text-muted-foreground">IP: {s.ip}</p> : null}
                    </div>
                  </div>
                  {!isCurrent ? <RevokeSessionButton sessionId={s.id} /> : null}
                </li>
              );
            })}
          </ul>
          <SessionBulkActions otherCount={sessions.filter((s) => s.id !== current?.sessionId).length} />
        </CardContent>
      </Card>
    </>
  );
}
