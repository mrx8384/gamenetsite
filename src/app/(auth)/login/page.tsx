import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "ورود", robots: { index: false } };

export default function LoginPage() {
  return (
    <AuthCard
      title="ورود به حساب کاربری"
      description="با رمز عبور یا کد یک‌بار مصرف وارد شوید."
      footer={
        <>
          حساب کاربری ندارید؟{" "}
          <Link href="/register" className="font-semibold text-link hover:underline">
            ثبت‌نام کنید
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthCard>
  );
}
