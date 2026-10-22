import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const base = env.APP_URL.replace(/\/+$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/partner", "/checkout", "/cart", "/payments", "/api", "/login", "/register", "/forgot-password", "/reset-password", "/design-system"] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
