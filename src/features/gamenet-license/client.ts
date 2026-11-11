import "server-only";
import { env } from "@/lib/env";

/** Account on the GameNet license server, as returned by its API. */
export interface GamenetLicense {
  id: string;
  username: string;
  businessName: string;
  status: "active" | "suspended" | "expired";
  endDateISO: string;
  subscriptionType: string;
  maxDevices: number;
  deviceCount: number;
  features: { remote: boolean };
  externalId: string | null;
}

export class GamenetApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

export const gamenetConfigured = () => !!(env.GAMENET_LICENSE_API_URL && env.GAMENET_LICENSE_API_KEY);

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!gamenetConfigured()) throw new GamenetApiError("not_configured", "اتصال به سرور نرم‌افزار تنظیم نشده است.", 0);
  let res: Response;
  try {
    // Accept the base address with or without the trailing /api/v1.
    const base = env.GAMENET_LICENSE_API_URL!.replace(/\/+$/, "").replace(/\/api\/v1$/, "");
    res = await fetch(`${base}/api/v1${path}`, {
      method,
      headers: { Authorization: `Bearer ${env.GAMENET_LICENSE_API_KEY}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new GamenetApiError("unreachable", "سرور نرم‌افزار در دسترس نیست؛ کمی بعد دوباره تلاش کنید.", 0);
  }
  const data = (await res.json().catch(() => ({}))) as { success?: boolean; code?: string; message?: string } & T;
  if (!res.ok || data.success === false) throw new GamenetApiError(data.code || `http_${res.status}`, data.message || "خطا از سرور نرم‌افزار.", res.status);
  return data;
}

export async function getGamenetLicense(externalId: string): Promise<GamenetLicense | null> {
  try {
    return (await call<{ license: GamenetLicense }>("GET", `/licenses/${encodeURIComponent(externalId)}`)).license;
  } catch (e) {
    if (e instanceof GamenetApiError && e.code === "not_found") return null;
    throw e;
  }
}

export async function createGamenetLicense(input: {
  externalId: string;
  username: string;
  password: string;
  businessName: string;
  ownerName?: string;
  phoneNumber?: string;
  endsAt: Date;
  remote: boolean;
}): Promise<GamenetLicense> {
  const { endsAt, ...rest } = input;
  return (await call<{ license: GamenetLicense }>("POST", "/licenses", { ...rest, endsAt: endsAt.toISOString() })).license;
}

export async function updateGamenetLicense(
  externalId: string,
  patch: { endsAt?: Date; status?: "active" | "suspended"; businessName?: string; ownerName?: string; phoneNumber?: string; remote?: boolean },
): Promise<GamenetLicense> {
  const { endsAt, ...rest } = patch;
  return (await call<{ license: GamenetLicense }>("PATCH", `/licenses/${encodeURIComponent(externalId)}`, { ...rest, ...(endsAt ? { endsAt: endsAt.toISOString() } : {}) })).license;
}

export async function setGamenetPassword(externalId: string, password: string): Promise<void> {
  await call("PUT", `/licenses/${encodeURIComponent(externalId)}/password`, { password });
}
