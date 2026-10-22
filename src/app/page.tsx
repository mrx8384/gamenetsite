import { Logo } from "@/components/logo";
import { siteConfig } from "@/lib/brand";

// TEMPORARY (Phase 3): replaced by the real homepage in Phase 4.
export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <Logo size={160} priority />
      <div className="space-y-2">
        <h1 className="text-3xl font-black tracking-tight">{siteConfig.name}</h1>
        <p className="text-muted-foreground">وب‌سایت در حال ساخت است.</p>
      </div>
    </main>
  );
}
