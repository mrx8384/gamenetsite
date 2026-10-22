import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Gamepad2, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { brand } from "@/lib/brand";
import { formatDate, formatToman, toPersianDigits } from "@/lib/format";
import { InteractiveDemos } from "./interactive-demos";

export const metadata: Metadata = { title: "سیستم طراحی", robots: { index: false } };

// Internal reference page for the design system. Not available in production.
export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const swatches = [
    ["سبز اتمی", brand.green],
    ["سبز تیره", brand.greenDark],
    ["سبز عمیق (متن)", brand.greenDeep],
    ["کرم", brand.cream],
    ["زرد اتمی", brand.yellow],
    ["مشکی", brand.black],
  ] as const;

  return (
    <main className="mx-auto w-full max-w-5xl space-y-12 px-4 py-10 sm:py-14">
      <header className="flex items-center gap-4">
        <Logo size={56} />
        <div>
          <h1 className="text-2xl font-black">سیستم طراحی ATOM</h1>
          <p className="text-sm text-muted-foreground">مرجع داخلی کامپوننت‌ها — فقط در محیط توسعه</p>
        </div>
      </header>

      <Section title="رنگ‌ها">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {swatches.map(([name, hex]) => (
            <div key={hex} className="overflow-hidden rounded-xl border bg-surface">
              <div className="h-16" style={{ background: hex }} />
              <div className="p-3 text-xs">
                <p className="font-semibold">{name}</p>
                <p className="ltr text-muted-foreground">{hex}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="تایپوگرافی">
        <div className="space-y-2">
          <p className="text-4xl font-black">باشگاه گیمینگ آتم</p>
          <p className="text-2xl font-bold">تیتر سطح دوم</p>
          <p className="text-lg font-semibold">تیتر سطح سوم</p>
          <p className="max-w-2xl leading-8 text-muted-foreground">
            متن بدنه با فونت وزیرمتن. اعداد فارسی: {toPersianDigits(1405)} — قیمت: {formatToman(BigInt(12_500_000))} — تاریخ:{" "}
            {formatDate(new Date("2026-10-22T08:00:00Z"))}
          </p>
          <p>
            <a href="#" className="text-link underline-offset-4 hover:underline">
              نمونهٔ لینک
            </a>
          </p>
        </div>
      </Section>

      <Section title="دکمه‌ها">
        <div className="flex flex-wrap gap-3">
          <Button>
            <ShoppingCart /> افزودن به سبد
          </Button>
          <Button variant="strong">دکمهٔ قوی</Button>
          <Button variant="accent">ویژه</Button>
          <Button variant="secondary">ثانویه</Button>
          <Button variant="outline">حاشیه‌دار</Button>
          <Button variant="ghost">بی‌زمینه</Button>
          <Button variant="destructive">
            <Trash2 /> حذف
          </Button>
          <Button variant="link">لینک</Button>
          <Button loading>در حال ارسال</Button>
          <Button disabled>غیرفعال</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">کوچک</Button>
          <Button>معمولی</Button>
          <Button size="lg">بزرگ</Button>
          <Button size="icon" aria-label="افزودن">
            <Plus />
          </Button>
        </div>
      </Section>

      <Section title="نشان‌ها">
        <div className="flex flex-wrap gap-2">
          <Badge>جدید</Badge>
          <Badge variant="accent">تخفیف</Badge>
          <Badge variant="strong">PS5</Badge>
          <Badge variant="secondary">پیش‌نویس</Badge>
          <Badge variant="outline">حاشیه‌دار</Badge>
          <Badge variant="success">منتشرشده</Badge>
          <Badge variant="warning">در انتظار تأیید</Badge>
          <Badge variant="destructive">رد شده</Badge>
          <Badge variant="info">در حال ارسال</Badge>
        </div>
      </Section>

      <Section title="فرم و ورودی‌ها">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="ds-name">نام و نام خانوادگی</Label>
            <Input id="ds-name" placeholder="مثلاً علی رضایی" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ds-phone">شمارهٔ موبایل</Label>
            <Input id="ds-phone" inputMode="numeric" dir="ltr" placeholder="09121234567" className="text-start" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ds-platform">پلتفرم</Label>
            <NativeSelect id="ds-platform" defaultValue="ps5">
              <option value="ps4">PS4</option>
              <option value="ps5">PS5</option>
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ds-invalid">ورودی نامعتبر</Label>
            <Input id="ds-invalid" aria-invalid defaultValue="abc" />
            <p className="text-xs text-destructive">ایمیل وارد شده معتبر نیست.</p>
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="ds-msg">پیام</Label>
            <Textarea id="ds-msg" placeholder="متن پیام..." />
          </div>
        </div>
      </Section>

      <Section title="کارت‌ها">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>کارت ساده</CardTitle>
              <CardDescription>توضیح کوتاه دربارهٔ محتوای کارت.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm leading-7">محتوای کارت اینجا قرار می‌گیرد.</CardContent>
            <CardFooter>
              <Button size="sm">اقدام</Button>
              <Button size="sm" variant="ghost">
                انصراف
              </Button>
            </CardFooter>
          </Card>
          <Card className="flex flex-col items-center justify-center gap-3 p-6 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-accent">
              <Gamepad2 className="size-6" />
            </span>
            <p className="font-bold">کارت ویژگی</p>
            <p className="text-sm text-muted-foreground">برای معرفی بخش‌های سایت</p>
          </Card>
          <Card className="space-y-3 p-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </Card>
        </div>
      </Section>

      <Section title="جدول">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>شماره سفارش</TableHead>
              <TableHead>مشتری</TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead>مبلغ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="ltr text-start">ATM-1001</TableCell>
              <TableCell>نمونهٔ توسعه</TableCell>
              <TableCell>
                <Badge variant="success">پرداخت‌شده</Badge>
              </TableCell>
              <TableCell>{formatToman(BigInt(45_000_000))}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="ltr text-start">ATM-1002</TableCell>
              <TableCell>نمونهٔ توسعه</TableCell>
              <TableCell>
                <Badge variant="warning">در انتظار پرداخت</Badge>
              </TableCell>
              <TableCell>{formatToman(BigInt(8_900_000))}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Section>

      <Section title="پیام‌ها و وضعیت‌ها">
        <div className="grid gap-3">
          <Alert variant="info" title="اطلاع">
            درگاه پرداخت هنوز فعال نشده است.
          </Alert>
          <Alert variant="success" title="انجام شد">
            تغییرات با موفقیت ذخیره شد.
          </Alert>
          <Alert variant="warning" title="توجه">
            موجودی این محصول رو به اتمام است.
          </Alert>
          <Alert variant="destructive" title="خطا">
            ذخیره‌سازی ناموفق بود.
          </Alert>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <EmptyState title="هنوز محصولی اضافه نشده" description="اولین محصول را از پنل مدیریت اضافه کنید." />
          <ErrorState />
          <Card className="space-y-4 p-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner /> در حال بارگذاری
            </div>
            <LoadingRows rows={3} />
          </Card>
        </div>
      </Section>

      <Section title="تعاملی">
        <InteractiveDemos />
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold">{title}</h2>
      <Separator />
      <div className="space-y-4">{children}</div>
    </section>
  );
}
