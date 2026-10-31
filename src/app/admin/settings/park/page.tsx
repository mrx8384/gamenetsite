import type { Metadata } from "next";
import { Suspense } from "react";
import { ExternalLink } from "lucide-react";
import { ParkManager } from "@/components/admin/settings/park-manager";
import { SiteSettingsForm } from "@/components/admin/settings/site-settings-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingRows } from "@/components/ui/states";
import { getAllAttractions, staticImageUrl } from "@/features/park/queries";
import { getSiteSettings } from "@/features/settings/site";
import { SITE_GROUPS } from "@/features/settings/site-schema";
import { requireRole } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "شهربازی اتم گیم" };

export default function ParkSettingsPage() {
  return (
    <Suspense fallback={<LoadingRows rows={6} />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await requireRole(["ADMIN"], "/admin/settings/park");
  const [texts, items] = await Promise.all([getSiteSettings("park"), getAllAttractions()]);
  const def = SITE_GROUPS.park;
  return (
    <div className="space-y-6">
      <a href="/amusement-park" target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-sm font-medium text-link hover:underline">
        <ExternalLink className="size-4" aria-hidden /> دیدن صفحهٔ شهربازی در سایت
      </a>
      <SiteSettingsForm group="park" description={def.description} fields={def.fields} initial={texts as Record<string, string>} />
      <Card>
        <CardHeader><CardTitle className="text-base">بازی‌ها و بخش‌ها (عکس و توضیح)</CardTitle></CardHeader>
        <CardContent>
          <ParkManager
            items={items.map((a) => ({ id: a.id, title: a.title, description: a.description, upload: a.image, staticImage: staticImageUrl(a.staticImage), isActive: a.isActive }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
