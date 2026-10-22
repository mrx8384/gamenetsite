import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <p className="text-6xl font-black text-brand-green">۴۰۴</p>
      <h1 className="text-xl font-bold">صفحه‌ای که دنبالش هستید پیدا نشد</h1>
      <p className="max-w-sm text-sm leading-7 text-muted-foreground">ممکن است آدرس اشتباه باشد یا این صفحه حذف شده باشد.</p>
      <Button asChild variant="strong">
        <Link href="/">بازگشت به صفحهٔ اصلی</Link>
      </Button>
    </main>
  );
}
