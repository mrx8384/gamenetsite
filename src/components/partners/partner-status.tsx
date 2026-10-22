import { Badge } from "@/components/ui/badge";
import { PARTNER_STATUS_BADGE, PARTNER_STATUS_LABELS, type PartnerStatusKey } from "@/features/partners/constants";

export function PartnerStatusBadge({ status }: { status: PartnerStatusKey }) {
  return <Badge variant={PARTNER_STATUS_BADGE[status]}>{PARTNER_STATUS_LABELS[status]}</Badge>;
}
