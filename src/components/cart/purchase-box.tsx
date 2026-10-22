import Link from "next/link";
import { Phone, Store } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getCommerceSettings } from "@/features/settings/commerce";
import { isSalesOpen } from "@/features/settings/sales";
import { toPersianDigits } from "@/lib/format";
import { AddToCart } from "./add-to-cart";

function PhoneButton({ phone }: { phone: string }) {
  return phone ? (
    <Button asChild variant="strong" size="lg">
      <a href={`tel:${phone}`}>
        <Phone /> <span className="ltr">{toPersianDigits(phone)}</span>
      </a>
    </Button>
  ) : (
    <Button asChild variant="strong" size="lg">
      <Link href="/contact">
        <Phone /> تماس با ما
      </Link>
    </Button>
  );
}

/** Buy area on the product page: call-for-price, sales closed, out of stock, or add-to-cart. */
export async function PurchaseBox({ productId, stock, priceOnRequest }: { productId: string; stock: number; priceOnRequest: boolean }) {
  const [settings, open] = await Promise.all([getCommerceSettings(), isSalesOpen()]);
  if (priceOnRequest) {
    return (
      <div className="space-y-3 rounded-xl border bg-surface p-5">
        <p className="font-bold">جهت استعلام قیمت تماس بگیرید</p>
        <p className="text-sm text-muted-foreground">قیمت این محصول به‌صورت تلفنی اعلام می‌شود.</p>
        <PhoneButton phone={settings.priceInquiryPhone} />
      </div>
    );
  }
  if (!open) {
    return (
      <Alert variant="info" title="فروش آنلاین به‌زودی فعال می‌شود">
        <span className="flex items-center gap-1">
          <Store className="size-4" aria-hidden /> برای خرید فعلاً با ما تماس بگیرید
          {settings.priceInquiryPhone ? <a href={`tel:${settings.priceInquiryPhone}`} className="ltr font-semibold text-link"> {toPersianDigits(settings.priceInquiryPhone)}</a> : null}.
        </span>
      </Alert>
    );
  }
  if (stock <= 0) return null;
  return <AddToCart productId={productId} maxQuantity={stock} />;
}
