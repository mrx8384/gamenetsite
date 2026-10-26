import type { Metadata, Viewport } from "next";
import { AdminApp } from "@/atom-world/admin/AdminApp";

export const metadata: Metadata = {
  title: "ویرایش دنیای سه‌بعدی اتم",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#07090a" };

/** World editor for the club's manager (password on the server: docs/ADMIN_WORLD.md). */
export default function AtomWorldAdminPage() {
  return <AdminApp />;
}
