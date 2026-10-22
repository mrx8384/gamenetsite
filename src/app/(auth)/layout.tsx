import Link from "next/link";
import { BrandLink } from "@/components/layout/brand-link";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(50%_40%_at_50%_0%,color-mix(in_oklab,var(--brand-green)_14%,transparent),transparent_70%)]"
      />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <BrandLink size={48} />
        </div>
        {children}
        <p className="mt-6 text-center text-sm">
          <Link href="/" className="text-muted-foreground hover:text-foreground">
            بازگشت به صفحهٔ اصلی
          </Link>
        </p>
      </div>
    </div>
  );
}
