import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import { getSiteSettings } from "@/features/settings/site";
import { siteConfig } from "@/lib/brand";
import { env } from "@/lib/env";
import "./globals.css";

// Self-hosted (no external CDN): reliable on Iranian hosting.
const vazirmatn = localFont({
  src: "./fonts/Vazirmatn-Variable.woff2",
  variable: "--font-vazirmatn",
  weight: "100 900",
  display: "swap",
  preload: true,
});

export async function generateMetadata(): Promise<Metadata> {
  const general = await getSiteSettings("general");
  return {
    title: { default: siteConfig.name, template: `%s | ${siteConfig.name}` },
    description: general.siteDescription,
    applicationName: siteConfig.name,
    metadataBase: new URL(env.APP_URL),
    openGraph: {
      type: "website",
      locale: "fa_IR",
      siteName: siteConfig.name,
      description: general.siteDescription,
      images: [{ url: "/brand/atom-logo-256.png", width: 256, height: 256, alt: siteConfig.name }],
    },
    twitter: { card: "summary" },
  };
}

export const viewport: Viewport = {
  themeColor: "#FAF9F3",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fa" dir="rtl" className={`${vazirmatn.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
