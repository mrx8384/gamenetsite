import type { Metadata } from "next";
import { Suspense } from "react";
import { Pencil, Plus, Truck } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ShippingDialog } from "@/components/admin/shipping/shipping-dialog";
import { DeleteButton } from "@/components/admin/store/delete-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingRows } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteShippingMethod } from "@/features/shipping/admin-actions";
import { requireRole } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatNumber, formatToman } from "@/lib/format";

export const metadata: Metadata = { title: "روش‌های ارسال" };

export default function ShippingPage() {
  return (
    <>
      <AdminPageHeader
        title="روش‌های ارسال"
        description="شرکت‌های حمل‌ونقل و نحوهٔ پرداخت هزینهٔ ارسال (پس‌کرایه یا پیش‌کرایه)."
        actions={<ShippingDialog trigger={<Button><Plus /> روش ارسال جدید</Button>} />}
      />
      <Suspense fallback={<LoadingRows rows={4} />}>
        <ShippingTable />
      </Suspense>
    </>
  );
}

async function ShippingTable() {
  await requireRole(["ADMIN"], "/admin/shipping");
  const methods = await db.shippingMethod.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], include: { _count: { select: { orders: true } } } });
  if (methods.length === 0) {
    return <EmptyState icon={Truck} title="هنوز روش ارسالی تعریف نشده" description="برای ثبت سفارش، حداقل یک روش ارسال فعال لازم است." />;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>نام</TableHead>
          <TableHead>نوع</TableHead>
          <TableHead>هزینه</TableHead>
          <TableHead>سفارش‌ها</TableHead>
          <TableHead>وضعیت</TableHead>
          <TableHead className="w-24"><span className="sr-only">عملیات</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {methods.map((m) => (
          <TableRow key={m.id}>
            <TableCell>
              <p className="font-medium">{m.name}</p>
              {m.description ? <p className="text-xs text-muted-foreground">{m.description}</p> : null}
            </TableCell>
            <TableCell>{m.type === "COLLECT" ? <Badge variant="info">پس‌کرایه</Badge> : <Badge variant="secondary">پیش‌کرایه</Badge>}</TableCell>
            <TableCell className="whitespace-nowrap">{m.type === "COLLECT" ? "تعیین توسط شرکت حمل" : m.price === BigInt(0) ? "رایگان" : formatToman(m.price)}</TableCell>
            <TableCell>{formatNumber(m._count.orders)}</TableCell>
            <TableCell>{m.isActive ? <Badge variant="success">فعال</Badge> : <Badge variant="outline">غیرفعال</Badge>}</TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <ShippingDialog
                  method={{ id: m.id, name: m.name, description: m.description ?? "", type: m.type, priceToman: (m.price / BigInt(10)).toString(), trackingUrl: m.trackingUrl ?? "", isActive: m.isActive, sortOrder: m.sortOrder }}
                  trigger={<Button variant="ghost" size="icon-sm" aria-label={`ویرایش ${m.name}`}><Pencil /></Button>}
                />
                <DeleteButton title={`حذف «${m.name}»؟`} description="سفارش‌های قبلی نام روش ارسال را حفظ می‌کنند." action={deleteShippingMethod.bind(null, m.id)} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
