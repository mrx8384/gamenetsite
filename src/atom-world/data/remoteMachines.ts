import { isTestPath, MACHINES_URL } from "../config";
import { rewardStore } from "../minigames/achievements";
import { BASE_MACHINES, type MachineInfo, machineStore } from "./machines";
import { createStore } from "../store";

export {
  type ClubInfo,
  EMPTY_CLUB,
  type MachineOverride,
  parseClub,
  parseMachineOverrides,
  parseRewards,
  safePhotoSrc,
} from "./overrideParsers";
import { type ClubInfo, EMPTY_CLUB, type MachineOverride, parseClub, parseMachineOverrides, parseRewards } from "./overrideParsers";

export const clubStore = createStore<ClubInfo>(EMPTY_CLUB);

// machine info from the site's admin panel and from this project's world editor (the editor wins)
let siteOverrides: Record<string, MachineOverride> = {};
let adminOverrides: Record<string, MachineOverride> = {};
let siteClub: ClubInfo = EMPTY_CLUB;
let adminClub: ClubInfo | null = null;
let siteRewards: Record<string, string> = {};
let adminRewards: Record<string, string> = {};

function publish() {
  machineStore.set({ byId: mergeMachines(mergeMachines(BASE_MACHINES, siteOverrides), adminOverrides) });
  clubStore.set(adminClub ?? siteClub);
  rewardStore.set({ byId: { ...siteRewards, ...adminRewards } });
}

/** World editor data (world/applyConfig.ts). */
export function setAdminOverrides(machines: Record<string, MachineOverride>, club: ClubInfo | null, rewards: Record<string, string>) {
  adminOverrides = machines;
  adminClub = club;
  adminRewards = rewards;
  publish();
}

export function mergeMachines(base: Record<string, MachineInfo>, overrides: Record<string, MachineOverride>) {
  const out: Record<string, MachineInfo> = { ...base };
  for (const [id, o] of Object.entries(overrides)) {
    if (out[id]) out[id] = { ...out[id], ...o };
  }
  return out;
}

let loaded: string | null = null;

/** Fetches the admin-panel data once per page load; on any failure the built-in data stays. */
export async function loadRemoteMachines(url: string = remoteUrl(), timeoutMs = 6000) {
  if (!url || loaded === url) return false;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" }, credentials: "omit" });
    if (!res.ok) return false;
    const json: unknown = await res.json();
    siteOverrides = parseMachineOverrides(json);
    siteRewards = parseRewards(json);
    siteClub = parseClub(json);
    publish();
    loaded = url;
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

/** Configured endpoint; with ?debug=1 a same-site `?machinesUrl=/path` can override it (tests). */
function remoteUrl() {
  if (typeof window === "undefined") return MACHINES_URL;
  const q = new URLSearchParams(window.location.search);
  const dbg = q.has("debug") ? q.get("machinesUrl") : null;
  if (dbg && isTestPath(dbg)) return dbg;
  return MACHINES_URL;
}
