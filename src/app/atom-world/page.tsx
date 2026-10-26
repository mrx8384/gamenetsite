import type { Metadata, Viewport } from "next";
import { AtomWorldLoader } from "@/atom-world/AtomWorldLoader";

export const metadata: Metadata = {
  title: "دنیای سه‌بعدی اتم",
  description: "با شخصیت پسر یا دختر اتم در فضای بازسازی‌شدهٔ مجموعهٔ ATOM GAME CLUB حرکت کنید.",
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

export default function AtomWorldPage() {
  return <AtomWorldLoader />;
}
