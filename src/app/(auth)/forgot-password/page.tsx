import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "بازیابی رمز عبور", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="بازیابی رمز عبور"
      description="کد بازیابی به موبایل یا ایمیل حساب شما ارسال می‌شود."
      footer={
        <Link href="/login" className="font-semibold text-link hover:underline">
          بازگشت به ورود
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
