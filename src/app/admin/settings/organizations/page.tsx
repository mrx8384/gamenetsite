import type { Metadata } from "next";
import { Suspense } from "react";
import { OrganizationsManager } from "@/components/admin/settings/organizations-manager";
import { SiteSettingsForm } from "@/components/admin/settings/site-settings-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingRows } from "@/components/ui/states";
import { getAllOrganizations } from "@/features/organizations/queries";
import { getSiteSettings } from "@/features/settings/site";
import { SITE_GROUPS } from "@/features/settings/site-schema";
import { requireRole } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "سازمان‌های طرف قرارداد" };

export default function OrganizationsSettingsPage() {
  return (
    <Suspense fallback={<LoadingRows rows={6} />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await requireRole(["ADMIN"], "/admin/settings/organizations");
  const [texts, orgs] = await Promise.all([getSiteSettings("organizations"), getAllOrganizations()]);
  const def = SITE_GROUPS.organizations;
  return (
    <div className="space-y-6">
      <SiteSettingsForm group="organizations" description={def.description} fields={def.fields} initial={texts as Record<string, string>} />
      <Card>
        <CardHeader><CardTitle className="text-base">سازمان‌ها</CardTitle></CardHeader>
        <CardContent>
          <OrganizationsManager
            organizations={orgs.map((o) => ({
              id: o.id,
              name: o.name,
              logo: o.logo,
              description: o.description ?? "",
              terms: o.terms ?? "",
              website: o.website ?? "",
              showDetails: o.showDetails,
              isActive: o.isActive,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
