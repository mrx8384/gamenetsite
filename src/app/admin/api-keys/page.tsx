import type { Metadata } from "next";
import { Suspense } from "react";
import { KeyRound } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { CreateApiKeyDialog, RevokeButton } from "@/components/admin/api-keys/api-key-controls";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, LoadingRows } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { API_RATE_PER_MINUTE } from "@/features/api/scopes";
import { requireRole } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { formatDateTime, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "کلیدهای API" };

export default function ApiKeysPage() {
  return (
    <>
      <AdminPageHeader title="کلیدهای API" description="اتصال برنامه‌های دیگر شما به رزرو و کدهای تخفیف سایت." actions={<CreateApiKeyDialog />} />
      <Suspense fallback={<LoadingRows rows={3} />}>
        <Keys />
      </Suspense>
    </>
  );
}

const ROUTES: [string, string, string][] = [
  ["GET", "/api/v1/ping", "بررسی کلید"],
  ["GET", "/api/v1/booking/shifts", "فهرست شیفت‌ها"],
  ["GET", "/api/v1/booking/availability?from=2026-11-20&days=7", "ظرفیت خالی هر روز و شیفت"],
  ["GET", "/api/v1/bookings?from=…&to=…&status=CONFIRMED", "فهرست رزروها"],
  ["POST", "/api/v1/bookings", "ثبت رزرو (پرداخت حضوری) — {date, shiftId, name, phone, guests?, note?, discountCode?}"],
  ["GET", "/api/v1/bookings/BK-123456", "یک رزرو"],
  ["PATCH", "/api/v1/bookings/BK-123456", "تغییر وضعیت — {status: COMPLETED | NO_SHOW | CANCELLED | CONFIRMED}"],
  ["POST", "/api/v1/discounts/check", "بررسی کد تخفیف — {code, scope: SHOP | BOOKING | TOURNAMENT, amountToman}"],
];

async function Keys() {
  await requireRole(["ADMIN"], "/admin/api-keys");
  const keys = await db.apiKey.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div className="space-y-6">
      {keys.length === 0 ? (
        <EmptyState icon={KeyRound} title="هنوز کلیدی نساخته‌اید" description="با «کلید جدید» برای برنامه‌تان یک کلید بسازید." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>نام</TableHead>
              <TableHead>کلید</TableHead>
              <TableHead>دسترسی‌ها</TableHead>
              <TableHead>آخرین استفاده</TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead className="w-28"><span className="sr-only">عملیات</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.map((k) => (
              <TableRow key={k.id}>
                <TableCell className="font-medium">{k.name}<p className="text-xs text-muted-foreground">ساخت: {formatDateTime(k.createdAt)}</p></TableCell>
                <TableCell><span className="ltr font-mono text-xs" dir="ltr">{k.prefix}…</span></TableCell>
                <TableCell className="ltr font-mono text-xs" dir="ltr">{k.scopes.join(", ")}</TableCell>
                <TableCell className="text-xs">{k.lastUsedAt ? formatDateTime(k.lastUsedAt) : "هرگز"}</TableCell>
                <TableCell>{k.revokedAt ? <Badge variant="outline">باطل شده</Badge> : <Badge variant="success">فعال</Badge>}</TableCell>
                <TableCell>{k.revokedAt ? null : <RevokeButton id={k.id} name={k.name} />}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Card>
        <CardHeader><CardTitle className="text-base">راهنمای استفاده برای برنامه‌نویس</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm leading-7">
          <p>آدرس پایه: <code className="ltr rounded bg-secondary px-1.5 font-mono text-xs" dir="ltr">{new URL("/api/v1", env.APP_URL).toString()}</code></p>
          <p>هر درخواست باید هدر <code className="ltr rounded bg-secondary px-1.5 font-mono text-xs" dir="ltr">Authorization: Bearer atm_…</code> داشته باشد. پاسخ‌ها JSON هستند: موفق <code className="ltr font-mono text-xs" dir="ltr">{"{success: true, data}"}</code> و خطا <code className="ltr font-mono text-xs" dir="ltr">{"{success: false, code, message}"}</code>. سقف {formatNumber(API_RATE_PER_MINUTE)} درخواست در دقیقه برای هر کلید. تاریخ‌ها میلادی به وقت تهران (YYYY-MM-DD)، مبلغ‌ها به ریال و تومان.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <tbody>
                {ROUTES.map(([m, p, d]) => (
                  <tr key={m + p} className="border-b last:border-0">
                    <td className="py-1.5 pe-2 font-mono font-bold" dir="ltr">{m}</td>
                    <td className="py-1.5 pe-3 font-mono" dir="ltr">{p}</td>
                    <td className="py-1.5">{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">راهنمای کامل با نمونه در فایل docs/API.md مخزن کد است.</p>
        </CardContent>
      </Card>
    </div>
  );
}
