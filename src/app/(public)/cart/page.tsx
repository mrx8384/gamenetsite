import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { ImageOff, ShoppingCart } from "lucide-react";
import { CartLineControls } from "@/components/cart/cart-line-controls";
import { OrderSummary } from "@/components/cart/order-summary";
import { Container } from "@/components/layout/container";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingRows } from "@/components/ui/states";
import { getCartView, type CartLineIssue } from "@/features/cart/queries";
import { isSalesOpen } from "@/features/settings/sales";
import { getCurrentUser } from "@/lib/auth/dal";
import { formatNumber, formatToman } from "@/lib/format";
import { mediaUrl } from "@/lib/media";

export const metadata: Metadata = { title: "سبد خرید", robots: { index: false } };

const issueText: Record<Exclude<CartLineIssue, null>, string> = {
  unavailable: "این محصول دیگر در دسترس نیست؛ آن را حذف کنید.",
  price_on_request: "فروش این محصول فقط با استعلام تلفنی است؛ آن را حذف کنید.",
  out_of_stock: "ناموجود شد؛ آن را حذف کنید.",
  insufficient_stock: "موجودی کافی نیست؛ تعداد را کم کنید.",
};

export default function CartPage() {
  return (
    <Container className="py-8 sm:py-12">
      <h1 className="mb-6 text-3xl font-black">سبد خرید</h1>
      <Suspense fallback={<LoadingRows rows={4} />}>
        <CartContent />
      </Suspense>
    </Container>
  );
}

async function CartContent() {
  if (!(await isSalesOpen())) {
    return <EmptyState icon={ShoppingCart} title="فروش آنلاین به‌زودی فعال می‌شود" description="در حال حاضر امکان خرید آنلاین وجود ندارد." action={<Button asChild variant="outline"><Link href="/shop">مشاهدهٔ محصولات</Link></Button>} />;
  }
  const user = await getCurrentUser();
  const cart = await getCartView(user?.id ?? null);
  if (cart.lines.length === 0) {
    return <EmptyState icon={ShoppingCart} title="سبد خرید شما خالی است" action={<Button asChild><Link href="/shop">رفتن به فروشگاه</Link></Button>} />;
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <ul className="divide-y rounded-xl border bg-surface">
        {cart.lines.map((l) => (
          <li key={l.id} className="flex gap-4 p-4">
            <Link href={`/shop/${encodeURIComponent(l.slug)}`} className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-secondary sm:size-24">
              {l.imageKey ? <Image src={mediaUrl(l.imageKey)} alt="" fill unoptimized sizes="96px" className="object-cover" /> : <ImageOff className="m-auto mt-7 size-6 text-muted-foreground" aria-hidden />}
            </Link>
            <div className="min-w-0 flex-1 space-y-2">
              <Link href={`/shop/${encodeURIComponent(l.slug)}`} className="line-clamp-2 font-semibold hover:text-link">{l.title}</Link>
              <p className="text-sm text-muted-foreground">{formatToman(BigInt(l.unitPrice))} × {formatNumber(l.quantity)}</p>
              {l.issue ? <p className="text-xs font-medium text-destructive">{issueText[l.issue]}</p> : null}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CartLineControls itemId={l.id} quantity={l.quantity} max={l.stock} />
                {!l.issue ? <span className="font-bold">{formatToman(BigInt(l.lineTotal))}</span> : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="space-y-3 lg:sticky lg:top-24 lg:self-start">
        <OrderSummary subtotal={cart.subtotal} shipping={{ kind: "pending" }}>
          {cart.orderable ? (
            <Button asChild size="lg" className="w-full"><Link href="/checkout">ادامه و ثبت سفارش</Link></Button>
          ) : (
            <Alert variant="warning">برای ادامه، موارد مشخص‌شده را اصلاح کنید.</Alert>
          )}
        </OrderSummary>
        {!user ? <p className="text-center text-xs text-muted-foreground">برای ثبت سفارش باید وارد حساب کاربری شوید؛ سبد شما حفظ می‌شود.</p> : null}
      </div>
    </div>
  );
}
