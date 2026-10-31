import type { Metadata, Viewport } from "next";
import { SectionGate } from "@/components/layout/section-gate";
import { Suspense } from "react";
import { AtomWorldLoader } from "@/atom-world/AtomWorldLoader";

export const metadata: Metadata = {
  title: "دنیای سه‌بعدی اتم",
  description: "با شخصیت پسر یا دختر اتم در فضای بازسازی‌شدهٔ مجموعهٔ ATOM GAME CLUB حرکت کنید.",
  alternates: { canonical: "/atom-world" },
  // installable on phones; works offline after «ذخیره برای اجرا بدون اینترنت» (public/atom-world/sw.js)
  manifest: "/atom-world/manifest.webmanifest",
  icons: { apple: "/atom-world/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "دنیای اتم", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#050605",
};

function AtomWorldPageContent() {
  return <AtomWorldLoader />;
}

/** Hidden from visitors when the admin turns the 3D world off (Admin → تنظیمات سایت → نمایش بخش‌ها). */
export default function AtomWorldPage() {
  return (
    <Suspense fallback={null}>
      <SectionGate section="atomWorld">
        <AtomWorldPageContent />
      </SectionGate>
    </Suspense>
  );
}
