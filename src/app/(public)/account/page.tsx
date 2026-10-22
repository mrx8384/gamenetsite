import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckCircle2 } from "lucide-react";
import { ContactChangeDialog } from "@/components/account/contact-change-dialog";
import { ProfileForm } from "@/components/account/profile-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingRows } from "@/components/ui/states";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "حساب کاربری", robots: { index: false } };

export default function AccountPage() {
  return (
    <Suspense fallback={<LoadingRows rows={5} />}>
      <AccountContent />
    </Suspense>
  );
}

async function AccountContent() {
  const sessionUser = await requireUser("/account");
  const user = await db.user.findUniqueOrThrow({
    where: { id: sessionUser.id },
    select: { name: true, email: true, phone: true, emailVerifiedAt: true, phoneVerifiedAt: true, createdAt: true, role: true },
  });

  return (
    <>
      <div>
        <h1 className="text-2xl font-black">سلام، {user.name}</h1>
        <p className="text-sm text-muted-foreground">عضو از {formatDate(user.createdAt)}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>اطلاعات حساب</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm name={user.name} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>راه‌های ارتباطی</CardTitle>
          <CardDescription>برای ورود با کد و بازیابی رمز عبور استفاده می‌شوند.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <ContactRow label="شمارهٔ موبایل" value={user.phone} verified={!!user.phoneVerifiedAt} kind="phone" />
          <ContactRow label="ایمیل" value={user.email} verified={!!user.emailVerifiedAt} kind="email" />
        </CardContent>
      </Card>
    </>
  );
}

function ContactRow({ label, value, verified, kind }: { label: string; value: string | null; verified: boolean; kind: "phone" | "email" }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        {value ? (
          <p className="ltr truncate text-start font-medium">{value}</p>
        ) : (
          <p className="text-sm text-muted-foreground">ثبت نشده</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {value && verified ? (
          <Badge variant="success">
            <CheckCircle2 /> تأییدشده
          </Badge>
        ) : null}
        <ContactChangeDialog kind={kind} hasValue={!!value} />
      </div>
    </div>
  );
}
