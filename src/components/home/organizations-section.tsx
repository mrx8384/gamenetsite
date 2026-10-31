import { connection } from "next/server";
import { Container } from "@/components/layout/container";
import { getActiveOrganizations } from "@/features/organizations/queries";
import { getSiteSettings } from "@/features/settings/site";
import { OrganizationsStrip } from "./organizations-strip";
import { SectionHeading } from "./section-heading";

/** «سازمان‌های طرف قرارداد» — hidden while there are no active organizations. */
export async function OrganizationsSection() {
  await connection();
  const [orgs, t] = await Promise.all([getActiveOrganizations(), getSiteSettings("organizations")]);
  if (orgs.length === 0) return null;
  return (
    <Container className="pb-14 sm:pb-20">
      <SectionHeading title={t.title} subtitle={t.subtitle || undefined} className="mb-5" />
      <OrganizationsStrip organizations={orgs} />
    </Container>
  );
}
