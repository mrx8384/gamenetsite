import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { AdminPageHeader } from "@/components/admin/page-header";
import { UserRowActions } from "@/components/admin/user-row-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { EmptyState, LoadingRows } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDate, formatNumber, toEnglishDigits } from "@/lib/format";

export const metadata: Metadata = { title: "کاربران" };

const PAGE_SIZE = 20;
const roleLabel = { ADMIN: "مدیر", USER: "کاربر", PARTNER: "همکار" } as const;
const roleVariant = { ADMIN: "strong", USER: "secondary", PARTNER: "info" } as const;

type Search = { q?: string; role?: string; status?: string; page?: string };

export default function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  return (
    <>
      <AdminPageHeader title="کاربران" description="جست‌وجو، تغییر نقش، غیرفعال‌سازی و مدیریت نشست‌های کاربران." />
      <Suspense fallback={<LoadingRows rows={8} />}>
        <UsersTable searchParams={searchParams as Promise<Search>} />
      </Suspense>
    </>
  );
}

async function UsersTable({ searchParams }: { searchParams: Promise<Search> }) {
  const admin = await requireRole(["ADMIN"], "/admin/users");
  const sp = await searchParams;
  const q = toEnglishDigits(String(sp.q ?? "")).trim().slice(0, 100);
  const role = sp.role === "ADMIN" || sp.role === "USER" || sp.role === "PARTNER" ? sp.role : undefined;
  const status = sp.status === "active" || sp.status === "inactive" ? sp.status : undefined;
  const page = Math.max(1, Number.parseInt(String(sp.page ?? "1"), 10) || 1);

  const where: Prisma.UserWhereInput = {
    ...(role ? { role } : {}),
    ...(status ? { isActive: status === "active" } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q.toLowerCase() } },
            { phone: { contains: q } },
          ],
        }
      : {}),
  };

  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, createdAt: true, lastLoginAt: true },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (role) params.set("role", role);
    if (status) params.set("status", status);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `?${s}` : "";
  };

  return (
    <div className="space-y-4">
      {/* Plain GET form: works without JavaScript and keeps filters in the URL. */}
      <form className="grid gap-3 rounded-xl border bg-surface p-4 sm:grid-cols-[1fr_160px_160px_auto]" role="search">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input name="q" defaultValue={q} placeholder="نام، ایمیل یا موبایل" className="ps-9" aria-label="جست‌وجو" />
        </div>
        <NativeSelect name="role" defaultValue={role ?? ""} aria-label="نقش">
          <option value="">همهٔ نقش‌ها</option>
          <option value="USER">کاربر</option>
          <option value="PARTNER">همکار</option>
          <option value="ADMIN">مدیر</option>
        </NativeSelect>
        <NativeSelect name="status" defaultValue={status ?? ""} aria-label="وضعیت">
          <option value="">همهٔ وضعیت‌ها</option>
          <option value="active">فعال</option>
          <option value="inactive">غیرفعال</option>
        </NativeSelect>
        <Button type="submit" variant="strong">
          اعمال فیلتر
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">{formatNumber(total)} کاربر</p>

      {users.length === 0 ? (
        <EmptyState icon={Users} title="کاربری پیدا نشد" description="فیلترها را تغییر دهید یا عبارت دیگری جست‌وجو کنید." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>نام</TableHead>
              <TableHead>موبایل / ایمیل</TableHead>
              <TableHead>نقش</TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead>عضویت</TableHead>
              <TableHead>آخرین ورود</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">عملیات</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium whitespace-nowrap">
                  {u.name}
                  {u.id === admin.id ? <span className="ms-2 text-xs text-muted-foreground">(شما)</span> : null}
                </TableCell>
                <TableCell className="ltr text-start text-xs leading-6">
                  {u.phone ? <div>{u.phone}</div> : null}
                  {u.email ? <div className="text-muted-foreground">{u.email}</div> : null}
                </TableCell>
                <TableCell>
                  <Badge variant={roleVariant[u.role]}>{roleLabel[u.role]}</Badge>
                </TableCell>
                <TableCell>{u.isActive ? <Badge variant="success">فعال</Badge> : <Badge variant="destructive">غیرفعال</Badge>}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(u.createdAt)}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{u.lastLoginAt ? formatDate(u.lastLoginAt) : "—"}</TableCell>
                <TableCell>
                  <UserRowActions user={{ id: u.id, name: u.name, role: u.role, isActive: u.isActive }} isSelf={u.id === admin.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {pages > 1 ? (
        <nav aria-label="صفحه‌بندی" className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            صفحهٔ {formatNumber(page)} از {formatNumber(pages)}
          </span>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" aria-disabled={page <= 1}>
              <Link href={qs(page - 1)}>قبلی</Link>
            </Button>
            <Button asChild variant="outline" size="sm" aria-disabled={page >= pages}>
              <Link href={qs(page + 1)}>بعدی</Link>
            </Button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
