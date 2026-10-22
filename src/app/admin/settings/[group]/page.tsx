import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SiteSettingsForm } from "@/components/admin/settings/site-settings-form";
import { LoadingRows } from "@/components/ui/states";
import { getSiteSettings } from "@/features/settings/site";
import { isSiteGroup, SITE_GROUPS } from "@/features/settings/site-schema";
import { requireRole } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "تنظیمات سایت" };

export default function SiteGroupPage({ params }: PageProps<"/admin/settings/[group]">) {
  return (
    <Suspense fallback={<LoadingRows rows={6} />}>
      <GroupForm params={params} />
    </Suspense>
  );
}

async function GroupForm({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params;
  await requireRole(["ADMIN"], `/admin/settings/${group}`);
  if (!isSiteGroup(group)) notFound();
  const def = SITE_GROUPS[group];
  const values = (await getSiteSettings(group)) as Record<string, string>;
  // Show what is actually saved; required texts fall back to defaults in getSiteSettings.
  return <SiteSettingsForm key={group} group={group} description={def.description} fields={def.fields} initial={values} />;
}
