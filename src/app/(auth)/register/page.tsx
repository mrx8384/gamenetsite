import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthNotice } from "@/components/auth/auth-notice";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
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
      <AuthNotice page="register" />
      <Suspense fallback={null}>
        <GoogleSignIn />
      </Suspense>
      <RegisterForm />
    </AuthCard>
  );
}
