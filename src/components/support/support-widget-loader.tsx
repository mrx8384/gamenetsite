import { Suspense } from "react";
import { connection } from "next/server";
import { getSiteSettings } from "@/features/settings/site";
import { SupportWidget } from "./support-widget";

async function Loader() {
  await connection();
  const s = await getSiteSettings("support");
  return <SupportWidget texts={{ title: s.title, welcome: s.welcome, hours: s.hours, loginText: s.loginText }} />;
}

/** Floating support chat; texts come from Admin → تنظیمات سایت → پشتیبانی آنلاین. */
export function SupportWidgetLoader() {
  return (
    <Suspense fallback={null}>
      <Loader />
    </Suspense>
  );
}
