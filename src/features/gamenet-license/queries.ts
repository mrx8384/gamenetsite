import "server-only";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { gamenetConfigured, getGamenetLicense } from "./client";
import { loadPartnerTerm } from "./sync";
import type { GamenetAccountView } from "@/components/partners/gamenet-app-card";

/** Data for the «نرم‌افزار مدیریت گیم‌نت» card in the partner area (null = feature not configured). */
export async function getGamenetSection(partnerId: string): Promise<{ entitled: boolean; account: GamenetAccountView | null; unavailable: boolean; downloadUrl: string | null } | null> {
  if (!gamenetConfigured()) return null;
  const loaded = await loadPartnerTerm(partnerId);
  const entitled = !!loaded?.term.entitled;
  try {
    const lic = await getGamenetLicense(partnerId);
    const account: GamenetAccountView | null = lic
      ? {
          username: lic.username,
          status: lic.status,
          endDate: lic.subscriptionType === "lifetime" ? "نامحدود" : formatDate(new Date(lic.endDateISO)),
          deviceCount: lic.deviceCount ?? 0,
          maxDevices: lic.maxDevices ?? 1,
          remote: !!lic.features?.remote,
        }
      : null;
    return { entitled, account, unavailable: false, downloadUrl: env.GAMENET_APP_DOWNLOAD_URL ?? null };
  } catch (e) {
    console.error("[gamenet-license] load failed", e);
    return { entitled, account: null, unavailable: true, downloadUrl: null };
  }
}
