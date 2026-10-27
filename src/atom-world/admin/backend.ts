"use client";

import { ADMIN_MODE, LOCAL_CONFIG_KEY } from "../config";
import { EMPTY_WORLD_CONFIG, parseWorldConfig, type WorldConfig } from "../world/config";
import { prepareImage } from "./image";

/**
 * Where the editor reads and saves. "server": the API (saved for every visitor; login with the
 * manager password, or — on the main site — with the site's admin account, then `loginUrl` is set).
 * "local": the stand-alone preview — no server, so changes stay on this device only.
 */
export interface AdminSession {
  enabled: boolean;
  admin: boolean;
  /** The site's own login page (the main site: its ADMIN accounts). */
  loginUrl?: string;
  /** A manager password is set on the server (ATOM_WORLD_ADMIN_PASSWORD). */
  password?: boolean;
}

export interface AdminBackend {
  mode: "server" | "local";
  session(): Promise<AdminSession>;
  login(password: string): Promise<"ok" | "wrong" | "rate" | "disabled" | "error">;
  logout(): Promise<void>;
  load(): Promise<WorldConfig>;
  save(cfg: WorldConfig): Promise<WorldConfig>;
  versions(): Promise<{ id: string; updatedAt: string }[]>;
  restore(id: string): Promise<WorldConfig | null>;
  /** Stores an image (resized in the browser first) and returns its URL. */
  upload(file: Blob): Promise<string>;
}

const API = "/api/atom-world";

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init, headers: { accept: "application/json", ...(init?.headers ?? {}) } });
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  return (await res.json()) as T;
}

const serverBackend: AdminBackend = {
  mode: "server",
  async session() {
    const s = await call<AdminSession>(`${API}/admin/session`);
    // only a page of this site (never another address) may be offered as the login
    const loginUrl = typeof s.loginUrl === "string" && /^\/(?!\/)/.test(s.loginUrl) ? s.loginUrl : undefined;
    return { enabled: !!s.enabled, admin: !!s.admin, password: s.password !== false, ...(loginUrl ? { loginUrl } : {}) };
  },
  async login(password) {
    try {
      await call(`${API}/admin/session`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
      return "ok";
    } catch (e) {
      const s = (e as { status?: number }).status;
      return s === 401 ? "wrong" : s === 429 ? "rate" : s === 503 ? "disabled" : "error";
    }
  },
  async logout() {
    await fetch(`${API}/admin/session`, { method: "DELETE" });
  },
  load: async () => parseWorldConfig(await call(`${API}/world`)),
  save: async (cfg) => parseWorldConfig(await call(`${API}/admin/world`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(cfg) })),
  versions: async () => (await call<{ versions: { id: string; updatedAt: string }[] }>(`${API}/admin/versions`)).versions,
  async restore(id) {
    try {
      return parseWorldConfig(await call(`${API}/admin/versions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }));
    } catch {
      return null;
    }
  },
  async upload(file) {
    const img = await prepareImage(file, 2048);
    const r = await call<{ url: string }>(`${API}/admin/upload`, { method: "POST", headers: { "content-type": img.type }, body: img });
    return r.url;
  },
};

const VERSIONS_KEY = "atom-world:admin-local-versions";

function readJson<T>(key: string, fallback: T): T {
  try {
    const v = window.localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

const localBackend: AdminBackend = {
  mode: "local",
  session: async (): Promise<AdminSession> => ({ enabled: true, admin: true }),
  login: async () => "ok",
  logout: async () => {},
  load: async () => parseWorldConfig(readJson(LOCAL_CONFIG_KEY, EMPTY_WORLD_CONFIG), { allowDataUrls: true }),
  async save(cfg) {
    const prev = readJson<WorldConfig | null>(LOCAL_CONFIG_KEY, null);
    const saved = { ...parseWorldConfig(cfg, { allowDataUrls: true }), updatedAt: new Date().toISOString() };
    if (prev?.updatedAt) {
      const list = readJson<WorldConfig[]>(VERSIONS_KEY, []);
      list.unshift(prev);
      try {
        window.localStorage.setItem(VERSIONS_KEY, JSON.stringify(list.slice(0, 5)));
      } catch {
        /* full: keep going without the older versions */
      }
    }
    window.localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(saved));
    return saved;
  },
  versions: async () => readJson<WorldConfig[]>(VERSIONS_KEY, []).map((v) => ({ id: v.updatedAt!, updatedAt: v.updatedAt! })),
  async restore(id) {
    const v = readJson<WorldConfig[]>(VERSIONS_KEY, []).find((c) => c.updatedAt === id);
    return v ? localBackend.save(v) : null;
  },
  async upload(file) {
    // no server: the (smaller) image is kept inside the saved config as a data URL
    const img = await prepareImage(file, 1024);
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(img);
    });
  },
};

export const backend: AdminBackend = ADMIN_MODE === "local" ? localBackend : serverBackend;
