import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "ثبت‌نام", robots: { index: false } };

export default function RegisterPage() {
  return (
    <AuthCard
      title="ساخت حساب کاربری"
      description="با شمارهٔ موبایل یا ایمیل ثبت‌نام کنید."
      footer={
        <>
          قبلاً ثبت‌نام کرده‌اید؟{" "}
          <Link href="/login" className="font-semibold text-link hover:underline">
            وارد شوید
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
