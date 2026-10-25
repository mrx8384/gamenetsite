import { Suspense } from "react";
import { connection } from "next/server";
import { getSiteSettings } from "@/features/settings/site";
import { getActiveFaqs } from "@/features/support/faq-queries";
import { SupportWidget } from "./support-widget";

async function Loader() {
  await connection();
  const [s, faqs] = await Promise.all([getSiteSettings("support"), getActiveFaqs()]);
  return <SupportWidget texts={{ title: s.title, welcome: s.welcome, hours: s.hours, loginText: s.loginText }} faqs={faqs} />;
}

/** Floating support chat; texts come from Admin → تنظیمات سایت → پشتیبانی آنلاین. */
export function SupportWidgetLoader() {
  return (
    <Suspense fallback={null}>
      <Loader />
    </Suspense>
  );
}
